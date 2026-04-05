# Framework Detection Guide

How to identify the frontend framework and locate API call sites in each.

## Detection by package.json

Check `dependencies` and `devDependencies`:

| Package | Framework | Notes |
|---------|-----------|-------|
| `next` | Next.js | App Router (`app/`) or Pages Router (`pages/`) |
| `react`, `react-dom` (no `next`) | React (Vite/CRA) | Check for `vite` in devDeps |
| `vue` | Vue | Check for `nuxt` for Nuxt |
| `nuxt` | Nuxt | Vue meta-framework |
| `svelte` | Svelte | Check for `@sveltejs/kit` |
| `@sveltejs/kit` | SvelteKit | Svelte meta-framework |
| `@angular/core` | Angular | Less common at hackathons |
| None of above | Vanilla JS | Check for `vite` as bundler |

## Config Files

Additional signals:
- `next.config.js` / `next.config.mjs` / `next.config.ts` → Next.js
- `nuxt.config.ts` / `nuxt.config.js` → Nuxt
- `svelte.config.js` → SvelteKit
- `vite.config.ts` / `vite.config.js` → Vite-based (check framework plugin)
- `angular.json` → Angular

## Where to Find API Calls

### React / Next.js

**Components** (`src/components/`, `src/app/`, `app/`):
```javascript
// Direct fetch
useEffect(() => {
  fetch('/api/chat', { method: 'POST', body: JSON.stringify(data) })
    .then(res => res.json())
}, []);

// With streaming
const response = await fetch('/api/chat', { method: 'POST', body });
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // process streaming chunks
}
```

**Data fetching hooks:**
- `useSWR('/api/data', fetcher)` — SWR
- `useQuery({ queryKey: ['data'], queryFn: fetchData })` — TanStack Query
- Custom hooks wrapping fetch

**Next.js API routes** (`app/api/`, `pages/api/`):
- These are the backend endpoints. Look at what they call externally (OpenAI, Anthropic, etc.)
- The frontend calls these routes; they in turn call real APIs

**Vercel AI SDK:**
```javascript
import { useChat } from 'ai/react';
const { messages, input, handleSubmit } = useChat({ api: '/api/chat' });
```

### Vue / Nuxt

**Composables and components:**
```javascript
// Nuxt useFetch
const { data } = await useFetch('/api/search', { method: 'POST', body: query });

// Nuxt useAsyncData
const { data } = await useAsyncData('key', () => $fetch('/api/data'));

// Direct fetch in setup
const response = await fetch('/api/chat', options);
```

**Nuxt server routes** (`server/api/`):
- Server-side API handlers
- Look for external API calls here

### Svelte / SvelteKit

**Load functions** (`+page.ts`, `+page.server.ts`):
```typescript
export async function load({ fetch }) {
  const response = await fetch('/api/data');
  return { data: await response.json() };
}
```

**Components** (`+page.svelte`):
```svelte
<script>
  import { onMount } from 'svelte';
  let data;
  onMount(async () => {
    const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(input) });
    data = await res.json();
  });
</script>
```

**SvelteKit API routes** (`src/routes/api/`):
- `+server.ts` files handle API requests

### Vanilla JS

**Look in:**
- `index.html` — inline scripts
- `src/main.js`, `src/app.js` — main entry
- `src/api.js`, `src/services/` — API utility files
- Any `.js` file with `fetch(`, `XMLHttpRequest`, `axios`

## Common AI SDK Patterns

These are especially common at hackathons:

```javascript
// OpenAI SDK
import OpenAI from 'openai';
const openai = new OpenAI();
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  stream: true
});

// Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();
const stream = client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  messages: [...]
});

// Vercel AI SDK
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
const result = streamText({
  model: openai('gpt-4'),
  prompt: '...'
});
```

## Environment Variable Patterns

| Framework | Env Var Prefix | Files |
|-----------|---------------|-------|
| Next.js | `NEXT_PUBLIC_` (client), none (server) | `.env.local`, `.env` |
| Vite | `VITE_` | `.env`, `.env.local` |
| Create React App | `REACT_APP_` | `.env`, `.env.local` |
| Nuxt | `NUXT_PUBLIC_` (client), `NUXT_` (server) | `.env`, `nuxt.config.ts` |
| SvelteKit | `PUBLIC_` | `.env`, `.env.local` |

Common API URL env var names:
- `*_API_URL`, `*_API_BASE`, `*_BASE_URL`
- `*_BACKEND_URL`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (for direct SDK usage)
