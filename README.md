# frontend-demo

A Claude Code skill that generates instant, pre-baked demo environments for hackathon projects. No more waiting for slow LLM calls during your 2-minute demo recording.

### Key Features

- **Zero Config** — Describe your demo flow in plain English. The skill handles everything else.
- **Framework Agnostic** — Auto-detects React, Vue, Svelte, or vanilla JS and adapts accordingly.
- **Realistic Streaming** — Simulates LLM typing effects with configurable speed, matching OpenAI and Anthropic SSE formats.
- **Self-Contained Output** — Generates a standalone `demo/` folder. One `npm start` runs the whole thing.
- **Hackathon-Tested** — Built for the 2-minute demo constraint. Every response is instant, every take is identical.

## The Problem

At hackathons, you typically get **2 minutes** to record a video demo. But real AI/LLM API calls are slow and unpredictable:
- Streaming responses take 5-15 seconds to complete
- API rate limits and timeouts can ruin a take
- Network issues at crowded hackathon venues are common
- You end up burning multiple takes waiting for spinners

## The Solution

`frontend-demo` analyzes your codebase, asks you to describe your demo flow in plain English, and generates a **standalone demo environment** with a mock server that replays pre-baked responses instantly -- including realistic streaming effects.

Your frontend runs exactly as-is, but talks to a local mock server instead of real APIs. The result: a demo that looks 100% real but runs flawlessly every time.

## How It Works

```
1. You describe your demo flow:
   "User types 'Plan my trip to Tokyo', AI streams a detailed itinerary,
    user clicks 'Export to PDF', download completes"

2. The skill analyzes your codebase:
   - Detects your framework (React, Vue, Svelte, vanilla JS)
   - Finds all API call sites
   - Maps endpoints and response shapes

3. Generates a demo/ folder:
   demo/
   ├── server.js              # Mock server with pre-recorded responses
   ├── fixtures/              # Response files (JSON, streaming text)
   ├── demo-config.json       # Your demo flow, structured
   ├── frontend/              # Your frontend, patched to use mock server
   ├── package.json           # npm start runs everything
   ├── .env                   # Points to localhost mock server
   └── README.md              # Run instructions

4. Run it:
   cd demo && npm start
   → Mock server + frontend start together
   → Every API call returns instantly with your scripted responses
   → Streaming responses drip-feed at realistic speed
```

## Supported Endpoint Types

| Type | How It Works | Use Case |
|------|-------------|----------|
| **Static JSON** | Returns canned response with optional delay | REST APIs, search results, data fetches |
| **Streaming (SSE)** | Drip-feeds text chunks at configurable speed | LLM chat responses, real-time generation |
| **WebSocket** | Replays scripted message sequences with timing | Live collaboration, real-time updates |

## Supported Frameworks

The skill is **framework-agnostic** and detects your stack automatically:

- React / Next.js
- Vue / Nuxt
- Svelte / SvelteKit
- Vanilla JS

It finds API calls across common patterns: `fetch()`, `axios`, OpenAI/Anthropic SDKs, `useSWR`, `useQuery`, and custom HTTP clients.

## Usage

### Generate a Demo Environment

```
/frontend-demo

> I need to record a demo for my hackathon project. The flow is:
> 1. User types a question about their code
> 2. AI streams back an analysis with suggestions
> 3. User clicks "Apply Fix" and the code updates
> 4. A success toast appears
```

The skill will:
1. Analyze your codebase (framework, endpoints, env vars)
2. Confirm the structured demo steps with you
3. Generate the `demo/` folder with mock server + patched frontend
4. Give you run instructions

### Run the Demo

```bash
cd demo
npm install
cd frontend && npm install && cd ..
npm start
```

Open the app in your browser and walk through each step. Every API call returns instantly with your scripted responses.

## Installation

### Clone Directly

```bash
git clone https://github.com/your-username/frontend-demo.git ~/.claude/skills/frontend-demo
```

### Or Copy Manually

```bash
# Create the skill directory
mkdir -p ~/.claude/skills/frontend-demo/{scripts,references}

# Copy all files
cp SKILL.md README.md ~/.claude/skills/frontend-demo/
cp scripts/mock-server-template.js ~/.claude/skills/frontend-demo/scripts/
cp references/*.md ~/.claude/skills/frontend-demo/references/
```

Then use it by typing `/frontend-demo` in Claude Code. The skill also auto-triggers when you mention creating a demo, recording a demo video, simulating API responses, or preparing for a hackathon presentation.

## Configuration

The generated `demo-config.json` lets you fine-tune each step:

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

| Field | Description |
|-------|-------------|
| `responseType` | `"static"`, `"streaming"`, or `"websocket"` |
| `streamingSpeed` | Characters per second for streaming responses (default: 30) |
| `delay` | Milliseconds before response starts (adds realism) |
| `fixture` | Path to the response file |

## Architecture

This skill uses **progressive disclosure** — the main `SKILL.md` is the workflow map, with supporting files loaded only when needed:

| File | Purpose | Loaded When |
|------|---------|-------------|
| `SKILL.md` | Core 4-phase workflow | Always (skill invocation) |
| `scripts/mock-server-template.js` | Express mock server template | Phase 3 (generation) |
| `references/framework-detection.md` | Framework + API call detection guide | Phase 1 (analysis) |
| `references/demo-config-schema.md` | Config JSON schema + examples | Phase 2 (flow capture) |
| `references/streaming-patterns.md` | OpenAI/Anthropic/Vercel AI streaming formats | Phase 3 (generation) |

## Philosophy

This skill was built from a few beliefs:

1. **Demo time is sacred.** At a hackathon, you have 2 minutes to show what you built. Every second spent waiting for an API is a second not spent impressing judges.

2. **The demo should feel real.** Static screenshots or pre-recorded videos don't land the same way. A live app with realistic streaming effects is convincing in a way that nothing else is.

3. **Simple beats clever.** A plain Express server with JSON fixtures is boring and that's the point. It works, it's debuggable, and it won't surprise you during recording.

4. **One command to run.** `npm start` should be the only thing between you and a working demo. No docker, no env setup, no prayer.

## Requirements

- [Claude Code](https://claude.ai/claude-code) CLI
- Node.js 18+ (for the mock server)
- npm (for dependency installation)

The generated demo environment uses only `express`, `cors`, and optionally `ws` — no heavy dependencies.

## Contributing

Contributions welcome. See the `references/` folder for documentation on framework detection, config schema, and streaming patterns.

## Credits

Created with Claude Code.

## License

MIT
