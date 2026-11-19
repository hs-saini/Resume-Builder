const MAX_BODY_BYTES = 8000;
const MAX_TEXT_LENGTH = 700;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function isAllowedOrigin(origin, requestHost) {
  if (!origin || !requestHost) return false;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const isHttps = parsedOrigin.protocol === "https:";
  const isLocalDevelopment = process.env.NODE_ENV === "development"
    && parsedOrigin.protocol === "http:"
    && ["localhost:3000", "127.0.0.1:3000"].includes(parsedOrigin.host);
  return parsedOrigin.host.toLowerCase() === requestHost.toLowerCase()
    && (isHttps || isLocalDevelopment);
}

function isShortText(value, maxLength) {
  return typeof value === "string" && value.length <= maxLength;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  if (!isAllowedOrigin(req.headers.origin, req.headers.host)) {
    return sendJson(res, 403, { error: "Request origin is not allowed." });
  }

  const declaredLength = Number(req.headers["content-length"] || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { error: "Request is too large." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: "Request body must be valid JSON." });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendJson(res, 400, { error: "Request body must be a JSON object." });
  }
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) {
    return sendJson(res, 413, { error: "Request is too large." });
  }

  const { language, role, education, skills, yearsExperience, experienceDetails } = body;
  if (
    !["en", "hi"].includes(language) ||
    !isShortText(role, 100) || !role.trim() ||
    !isShortText(education, 2000) ||
    !Array.isArray(skills) || skills.length > 15 || !skills.every((skill) => isShortText(skill, 100)) ||
    !isShortText(yearsExperience, 20) ||
    !isShortText(experienceDetails, MAX_TEXT_LENGTH)
  ) {
    return sendJson(res, 400, { error: "Profile details are invalid or too long." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 503, { error: "AI objective generation is not configured." });
  }

  const languageName = language === "hi" ? "Hindi" : "English";
  const profile = {
    targetRole: role.trim(),
    education: education.trim(),
    selectedSkills: skills.map((skill) => skill.trim()).filter(Boolean),
    yearsExperience: yearsExperience.trim(),
    experienceDetails: experienceDetails.trim()
  };
  let providerResponse;
  try {
    providerResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content: `Write one concise, professional resume career objective in ${languageName}. Tailor it to the target role, education, skills, and work history. Use only facts in the profile; do not invent qualifications, employers, achievements, or metrics. Return only the objective, without a heading or quotation marks.`
          },
          { role: "user", content: JSON.stringify(profile) }
        ]
      })
    });
  } catch {
    return sendJson(res, 502, { error: "Could not reach the AI objective service." });
  }

  if (!providerResponse.ok) {
    return sendJson(res, 502, { error: "The AI objective service could not complete the request." });
  }

  let providerData;
  try {
    providerData = await providerResponse.json();
  } catch {
    return sendJson(res, 502, { error: "The AI objective service returned an invalid response." });
  }

  const objective = providerData?.choices?.[0]?.message?.content;
  if (typeof objective !== "string" || !objective.trim() || objective.length > 1500) {
    return sendJson(res, 502, { error: "The AI objective service returned no usable objective." });
  }

  return sendJson(res, 200, { objective: objective.trim() });
};
