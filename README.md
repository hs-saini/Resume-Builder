# Half Engineer Resume Builder

A bilingual English/Hindi resume builder with live preview, three print-ready templates, and a profile-based career objective generator.

## Run locally

Open `index.html` in a browser to use the on-device resume builder. The AI objective endpoint requires the Vercel development server:

1. Install the Vercel CLI.
2. Set `OPENAI_API_KEY` in a local `.env.local` file (never commit this file).
3. Run `vercel dev` from the project directory.

The local objective is generated in the browser and works without an API key. The optional OpenAI objective is sent only after the user checks the consent box and selects **Generate with AI**. The app sends only target role, education, selected skills, and work experience—not a name, date of birth, address, phone number, or email.

## Deploy to Vercel

Import the GitHub repository as a new Vercel project, then add `OPENAI_API_KEY` as an encrypted Environment Variable in the Vercel project settings. Optionally set `OPENAI_MODEL`; the default is `gpt-4o-mini`. Redeploy after adding or changing environment variables.

The API key is used only by `api/objective.js` and must never be added to client-side code or committed files.
