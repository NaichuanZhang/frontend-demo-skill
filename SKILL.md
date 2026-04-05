---
name: frontend-demo
description: Generate instant, pre-baked demo environments for hackathon projects. Creates a standalone demo/ folder with a mock server and patched frontend that replays scripted API responses (including realistic LLM streaming) without real API calls. Use this skill whenever the user mentions creating a demo, recording a demo video, preparing a hackathon presentation, simulating API responses for a recording, needing a pre-baked or scripted demo, mock endpoints for demo purposes, or wanting their demo to run without real backend calls. Also trigger when users mention time-constrained recordings, demo dry-runs, or rehearsing a product walkthrough.
---

# Demo Prep

Generate a self-contained demo environment that replays pre-baked API responses instantly — including realistic streaming effects — so hackathon demos run flawlessly every time.

The reason this skill exists: at hackathons, teams get ~2 minutes to record a demo. Real LLM/API calls are slow and unreliable, eating up precious recording time. This skill eliminates that problem by creating a mock server with scripted responses that look identical to the real thing.

## Workflow Overview

```
Phase 1: Analyze Codebase
    ↓
Phase 2: Capture Demo Flow (interview user)
    ↓
Phase 3: Generate demo/ Folder
    ↓
Phase 4: Verify & Hand Off
```

---

## Phase 1: Codebase Analysis

Understand the project's frontend and API surface before generating anything.

### 1.1 Detect Frontend Framework

Read `package.json` and check dependencies:

| Dependency | Framework |
|-----------|-----------|
| `react`, `react-dom` | React |
| `next` | Next.js (React) |
| `vue` | Vue |
| `nuxt` | Nuxt (Vue) |
| `svelte` | Svelte |
| `@sveltejs/kit` | SvelteKit |
| None of the above | Vanilla JS |

Also check for meta-frameworks by looking at config files: `next.config.*`, `nuxt.config.*`, `svelte.config.*`, `vite.config.*`.

See `references/framework-detection.md` for detailed patterns per framework.

### 1.2 Find API Call Sites

Search the codebase for all places that make HTTP requests. Look for these patterns:

**Direct HTTP calls:**
- `fetch(` — native fetch API
- `axios.` — axios library
- `$fetch(` — Nuxt's built-in fetch
- `ky.` / `ky(` — ky library

**SDK calls (common at hackathons):**
- `openai.chat.completions.create` — OpenAI SDK
- `anthropic.messages.create` — Anthropic SDK
- `client.chat(` — various AI SDK wrappers
- `ai.streamText` / `ai.generateText` — Vercel AI SDK

**React-specific data fetching:**
- `useEffect` with fetch/axios inside
- `useSWR(` — SWR hooks
- `useQuery(` — TanStack Query / React Query
- `useFetch(` — custom or library hooks

**Vue-specific:**
- `useFetch(` / `useAsyncData(` — Nuxt composables
- `onMounted` with fetch inside

**Svelte-specific:**
- `+page.server.ts` / `+page.ts` load functions
- `onMount` with fetch inside

For each call site found, extract:
- The endpoint URL (may be a template literal or variable)
- HTTP method
- Request body shape (if visible)
- How the response is consumed (JSON parse, streaming reader, etc.)

### 1.3 Map Endpoints

Build a list of unique endpoints the frontend talks to. For each endpoint, record:
- URL pattern (e.g., `/api/chat`, `/api/search?q=...`)
- HTTP method (GET, POST, etc.)
- Request body shape (from call sites or TypeScript types)
- Response type: static JSON, streaming (SSE/chunked), or WebSocket
- Response shape (from TypeScript types, existing mock data, or inference from usage)

### 1.4 Find Environment Variables

Check for API base URL configuration:
- `.env`, `.env.local`, `.env.development`
- `next.config.js` (rewrites/redirects)
- `vite.config.ts` (proxy config)
- `nuxt.config.ts` (runtimeConfig)

Common env var names:
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BASE_URL`
- `VITE_API_BASE`, `VITE_API_URL`
- `REACT_APP_API_URL`
- `NUXT_PUBLIC_API_BASE`
- `API_URL`, `BASE_URL`

This tells us how to redirect the frontend to our mock server with minimal changes.

### 1.5 Present Analysis to User

Before proceeding, summarize findings:

> **Codebase Analysis:**
> - Framework: [detected framework]
> - API endpoints found: [list with methods and response types]
> - Base URL configured via: [env var name or hardcoded]
>
> Does this look right? Any endpoints I missed?

Wait for user confirmation before moving to Phase 2.

---

## Phase 2: Demo Flow Interview

Get the user's demo flow as natural language, then structure it.

### 2.1 Ask for the Demo Flow

Prompt the user:

> Describe your demo flow step by step. For example:
> 1. User types "Plan my trip to Tokyo" in the chat input
> 2. AI streams back a detailed travel itinerary
> 3. User clicks "Save" and a confirmation toast appears
>
> Include what the user does AND what the app should show in response. Be specific about the content of AI responses — I'll use this as the actual demo text.

### 2.2 Parse Into Structured Steps

For each step the user describes, create a structured entry:

```json
{
  "id": 1,
  "userAction": "Types 'Plan my trip to Tokyo' and hits Enter",
  "endpoint": "/api/chat",
  "method": "POST",
  "requestBody": { "message": "Plan my trip to Tokyo" },
  "responseType": "streaming",
  "fixture": "fixtures/step-1-stream.txt",
  "fixtureContent": "The full text that will be streamed as the response...",
  "streamingSpeed": 30,
  "delay": 200
}
```

**Field definitions:**

| Field | Description | Default |
|-------|-------------|---------|
| `id` | Step number, sequential | — |
| `userAction` | What the human does during the demo | — |
| `endpoint` | The API endpoint this step hits | — |
| `method` | HTTP method | `POST` |
| `requestBody` | Expected request payload (for matching) | `{}` |
| `responseType` | `static`, `streaming`, or `websocket` | `static` |
| `fixture` | Path to the fixture file | auto-generated |
| `fixtureContent` | The actual response content | — |
| `streamingSpeed` | Chars/sec for streaming (higher = faster typing) | `30` |
| `delay` | Ms before response starts (adds realism) | `200` |

### 2.3 Handle Response Content

For each step, the mock response content needs to be realistic and specific:

- **If the user provided specific response text** in their flow description, use it directly
- **If the user described the response vaguely** (e.g., "AI responds with a travel plan"), draft a realistic response and confirm with the user
- **For streaming responses**, write the full text that will be drip-fed. Include markdown formatting if the real app renders markdown.
- **For static JSON**, construct a realistic response object matching the shape the frontend expects

### 2.4 Confirm with User

Present the structured demo flow:

> **Demo Flow (3 steps):**
>
> **Step 1:** User types "Plan my trip to Tokyo" → `POST /api/chat`
> - Response: Streaming at 30 chars/sec, 200ms delay
> - Content: "Here's a 5-day Tokyo itinerary..." (523 chars)
>
> **Step 2:** User clicks "Save" → `POST /api/save`
> - Response: Static JSON, 100ms delay
> - Content: `{ "id": "trip-123", "status": "saved" }`
>
> **Step 3:** Success toast appears (frontend-only, no API call)
>
> Want to adjust any of these?

Wait for user approval before generating.

---

## Phase 3: Generate `demo/` Folder

Create the self-contained demo environment.

### 3.1 Create Folder Structure

```
demo/
├── server.js              # Mock server (from template)
├── fixtures/              # Response files
│   ├── step-1-stream.txt
│   ├── step-2-response.json
│   └── ...
├── demo-config.json       # Structured demo flow
├── frontend/              # Copied + patched frontend
├── package.json           # Runs everything with one command
├── .env                   # Mock server URL
└── README.md              # How to run the demo
```

### 3.2 Generate Mock Server

Copy the bundled template from `scripts/mock-server-template.js` and customize it:

1. Read the template file
2. The template is a self-contained Express server that:
   - Reads `demo-config.json` at startup
   - Registers routes for each endpoint in the config
   - Matches incoming requests to steps by endpoint + method
   - Serves the appropriate fixture based on `responseType`:
     - **Static**: reads JSON fixture, returns after `delay` ms
     - **Streaming**: reads text fixture, sends as SSE chunks at `streamingSpeed` chars/sec
     - **WebSocket**: replays scripted message sequence
   - Logs each served response for debugging
   - Enables CORS for all origins

The template handles the core server logic. Customization is minimal — the config drives behavior.

### 3.3 Create Fixture Files

For each step in the demo flow:

- **Streaming steps**: Write the response text to `fixtures/step-{id}-stream.txt` as plain text
- **Static steps**: Write the JSON response to `fixtures/step-{id}-response.json`
- **WebSocket steps**: Write the message sequence to `fixtures/step-{id}-messages.json` as an array of `{ "data": ..., "delay": ... }` objects

### 3.4 Generate `demo-config.json`

Write the full config file:

```json
{
  "steps": [
    {
      "id": 1,
      "description": "User asks about Tokyo trip",
      "endpoint": "/api/chat",
      "method": "POST",
      "responseType": "streaming",
      "fixture": "fixtures/step-1-stream.txt",
      "streamingSpeed": 30,
      "delay": 200
    }
  ],
  "server": {
    "port": 3001,
    "corsOrigin": "*"
  }
}
```

### 3.5 Copy and Patch Frontend

1. **Copy the frontend source** into `demo/frontend/`
   - For Next.js: copy the relevant source files and config
   - For Vite-based (React/Vue/Svelte): copy `src/`, `public/`, config files
   - Skip: `node_modules/`, `.git/`, build output, test files

2. **Patch the API base URL** to point to the mock server:
   - Create/update `.env` with `API_BASE_URL=http://localhost:3001` (using the framework's env var convention)
   - If the app uses hardcoded URLs, patch them directly in the copied source
   - If the app uses a proxy config (e.g., Vite proxy or Next.js rewrites), update to point to mock server

3. **Copy `package.json`** and ensure dev dependencies are present

### 3.6 Generate Demo `package.json`

Create a `package.json` in the `demo/` root that runs everything:

```json
{
  "name": "demo",
  "private": true,
  "scripts": {
    "start": "concurrently \"npm run server\" \"npm run frontend\"",
    "server": "node server.js",
    "frontend": "cd frontend && npm run dev"
  },
  "dependencies": {
    "express": "^4.18.0",
    "concurrently": "^8.0.0",
    "cors": "^2.8.0"
  }
}
```

Add `ws` to dependencies if any step uses WebSocket.

### 3.7 Generate Demo README.md

Write instructions specific to this demo:

```markdown
# Demo - [Project Name]

## Quick Start

1. Install dependencies:
   ```
   npm install
   cd frontend && npm install && cd ..
   ```

2. Start the demo:
   ```
   npm start
   ```

3. Open http://localhost:[frontend-port] in your browser

## Demo Flow

1. [Step 1 description]
2. [Step 2 description]
...

## Tips for Recording

- Use a screen recorder (OBS, QuickTime, Loom)
- Set browser to a clean profile (no extensions visible)
- Resize browser to 1920x1080 for consistent recording
- Do a dry run first to practice timing
- The streaming speed can be adjusted in demo-config.json
```

---

## Phase 4: Verification

Help the user validate the demo works.

### 4.1 Run Instructions

Tell the user:

> Your demo environment is ready in `demo/`. To test it:
>
> ```bash
> cd demo
> npm install
> cd frontend && npm install && cd ..
> npm start
> ```
>
> Then open the app in your browser and walk through each demo step.

### 4.2 Troubleshooting Checklist

If something doesn't work, check:
- Is the mock server running? (check terminal for "Mock server listening on port 3001")
- Is the frontend pointing to the mock server? (check `.env` or network tab)
- Are fixtures loading? (check mock server logs for "Serving fixture: ...")
- Is streaming speed right? (adjust `streamingSpeed` in `demo-config.json`)

### 4.3 Fine-tuning

After the dry run, offer to help adjust:
- Streaming speed (faster/slower typing effect)
- Response delays (more/less realistic pauses)
- Response content (different wording, longer/shorter)
- Additional steps the user forgot to include

---

## Important Notes

- The `demo/` folder is **gitignored by default** — it's meant for local recording, not deployment
- The mock server only needs `express` and optionally `ws` — no heavy dependencies
- Streaming simulation uses `text/event-stream` (Server-Sent Events) which is how most LLM APIs work
- The fixture files are plain text/JSON — easy to edit manually if needed
- If the user's app uses authentication, the mock server skips auth checks entirely
