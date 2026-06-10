# Fewter

Convert a Figma frame into a Gmail-ready email signature. Sign in with Figma, paste a frame URL, and Fewter fetches your design, re-hosts images, and generates table-based HTML with inline CSS. Refine the result in the built-in AI chat, preview it at desktop or mobile widths, then copy it straight into Gmail.

## Prerequisites

- [Bun](https://bun.sh) (package manager and runtime)
- A [Figma](https://www.figma.com) account with access to the file you want to convert
- An [imgbb](https://imgbb.com) API key (image hosting)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (Gemini, for HTML generation and chat refinement)

## Local development

```bash
bun install
cp .env.example .env
# Fill in all values in .env (see below)
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
bun run build    # production build
bun run start    # run production server
bun run lint     # Biome check
bun run format   # Biome format
```

## Environment variables

Copy `.env.example` to `.env` and set every value:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Random secret for Auth.js sessions. Generate with `openssl rand -base64 32`. |
| `AUTH_FIGMA_ID` | Figma OAuth client ID |
| `AUTH_FIGMA_SECRET` | Figma OAuth client secret |
| `AUTH_URL` | App base URL. Local: `http://localhost:3000`. Production: `https://your-domain.com` |
| `IMGBB_API_KEY` | imgbb API key for permanent image URLs |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key from Google AI Studio |

---

## Figma OAuth app registration

Fewter uses [Auth.js](https://authjs.dev) with the Figma OAuth provider so it can read your design files on your behalf.

### 1. Create a Figma OAuth app

1. Go to [figma.com/developers/apps](https://www.figma.com/developers/apps) and sign in.
2. Click **Create a new app** (or open an existing app).
3. Note the **Client ID** and **Client secret** — these map to `AUTH_FIGMA_ID` and `AUTH_FIGMA_SECRET`.

### 2. Configure the redirect URI

In your Figma app settings, add these **Redirect URIs** (OAuth callback URLs):

| Environment | Callback URL |
|-------------|--------------|
| Local dev | `http://localhost:3000/api/auth/callback/figma` |
| Production | `https://your-domain.com/api/auth/callback/figma` |

Replace `your-domain.com` with your deployed hostname (e.g. your Vercel URL).

### 3. Scopes

Fewter requests read-only file access:

- `file_content:read` — read node trees and export images
- `file_metadata:read` — read file metadata

These are configured automatically in the app; you do not need to change scope settings in the Figma developer console beyond enabling OAuth for your app.

### 4. Add credentials to `.env`

```bash
AUTH_FIGMA_ID=your_client_id
AUTH_FIGMA_SECRET=your_client_secret
AUTH_URL=http://localhost:3000
AUTH_SECRET=your_generated_secret
```

### 5. Verify sign-in

1. Run `bun dev` and open the app.
2. Click **Sign in with Figma** in the header.
3. Approve the authorization prompt.
4. You should return to the home page, signed in with your Figma avatar shown.

**Troubleshooting**

- **Redirect URI mismatch** — the callback URL in Figma must exactly match `AUTH_URL` + `/api/auth/callback/figma` (including `http` vs `https` and no trailing slash on the base URL).
- **File access denied** — you must have permission to view the Figma file. Private files in another team require membership or a share link with view access.
- **Session expired** — sign out and sign in again. Fewter refreshes access tokens automatically when a refresh token is available.

---

## imgbb setup

Figma image export URLs are temporary. Fewter downloads assets during conversion and uploads them to imgbb so Gmail receives stable `https://` image links.

### 1. Get an API key

1. Create a free account at [imgbb.com](https://imgbb.com).
2. Open the [imgbb API page](https://api.imgbb.com/).
3. Copy your **API key**.

### 2. Add to `.env`

```bash
IMGBB_API_KEY=your_imgbb_api_key
```

The key is used only on the server (`POST /api/convert`). It is never exposed to the browser.

### 3. Notes

- Uploaded images are hosted on imgbb’s CDN with permanent URLs by default.
- Fewter caps exports at 20 images per conversion to stay within reasonable limits.
- If conversion fails during the upload step, check that your API key is valid and that imgbb is reachable from your server.

---

## Gemini API key

HTML generation and the refinement chat use Google’s Gemini models via the Vercel AI SDK.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Create an API key for your Google Cloud / AI Studio project.
3. Add it to `.env`:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

---

## How to convert a signature

1. **Sign in with Figma** using the header button.
2. **Copy a frame URL** from Figma. The URL must include a `node-id` query parameter — select the signature frame in Figma, then copy the link from the browser address bar.

   Example:

   ```
   https://www.figma.com/design/AbCdEf123/My-File?node-id=12-34
   ```

   Branch URLs are also supported (`/design/.../branch/...`).

3. **Paste the URL** into the input and click **Convert**. The pipeline fetches the frame, uploads images to imgbb, and generates email-safe HTML (typically 10–30 seconds).
4. **Preview** the signature at 600px (desktop) or 320px (mobile). Links and icons are clickable in the preview.
5. **Refine** (optional) using the chat panel — e.g. “make the name bolder”, “fix the LinkedIn link”, “reduce spacing”. Use **Undo** to revert the last edit without another API call.
6. **Copy for Gmail** when you are happy with the result.

---

## Pasting into Gmail

Gmail signatures need rich HTML pasted from a rendered source, not raw markup typed into the editor.

### Recommended: Copy for Gmail button

1. After conversion (and any chat refinements), click **Copy for Gmail** below the preview.
2. In Gmail, open **Settings** (gear icon) → **See all settings**.
3. Under the **General** tab, find the **Signature** section.
4. Click inside your signature editor (create one if needed).
5. Paste with **⌘V** (Mac) or **Ctrl+V** (Windows/Linux).

The button writes both `text/html` and `text/plain` to the clipboard so Gmail receives formatted content, not escaped tags.

### If clipboard copy fails

Some browsers block rich clipboard access. If you see the fallback message:

1. Click inside the **preview** panel (the rendered signature).
2. Select all (**⌘A** / **Ctrl+A**) and copy (**⌘C** / **Ctrl+C**).
3. Paste into Gmail Settings → General → Signature as above.

### Tips for best results in Gmail

- Paste into the signature rich-text editor — do not paste raw HTML into a plain-text field.
- Use the **Copy for Gmail** button rather than copying from the “View HTML source” panel.
- Preview at 600px width before copying; that matches typical email signature width.
- Test by composing a new email and checking layout, links, and images.

---

## Gmail compatibility notes

Email clients impose stricter rules than web pages. Fewter generates output with these constraints in mind:

| Topic | Behavior |
|-------|----------|
| Layout | Nested `<table>` elements with inline `style=""` only — no flexbox, grid, or layout `<div>`s |
| CSS | No `<style>` blocks or classes; Gmail strips most embedded styles |
| Images | `<img>` tags with explicit `width`, `height`, `alt`, and hosted `https://` URLs (imgbb) — no base64 |
| Fonts | Custom Figma fonts fall back to `Arial, Helvetica, sans-serif` in most clients |
| Effects | Blur, shadows, and complex gradients may simplify or drop in email |
| Interactivity | No JavaScript in the signature itself; preview interactivity is for testing links only |
| Width | Signatures are generated for ~600px max width |

Gmail may still rewrite some HTML after paste. The in-app preview is the best guide to how the signature will look; send yourself a test email if layout is critical.

---

## Deploy on Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Set all environment variables from `.env.example` in the Vercel project settings.
3. Set `AUTH_URL` to your production URL (e.g. `https://fewter.vercel.app`).
4. Add the production callback URL to your Figma OAuth app: `https://your-domain.com/api/auth/callback/figma`.
5. Deploy. Auth.js uses `trustHost: true` for Vercel-hosted deployments.

---

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Bun** — install and dev server
- **Auth.js v5** — Figma OAuth with PKCE and token refresh
- **Vercel AI SDK** + **Gemini** — conversion and chat refinement
- **imgbb** — permanent image hosting
- **shadcn/ui** + Tailwind CSS
- **Biome** — lint and format
