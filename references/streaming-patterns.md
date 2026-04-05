# Streaming Patterns Guide

How different LLM APIs stream responses and how to simulate each with the mock server.

## Overview

Most LLM APIs use **Server-Sent Events (SSE)** for streaming. The wire format is the same (`text/event-stream`), but the JSON payload structure differs by provider. The mock server supports three formats out of the box.

## Format Comparison

| Provider | Content-Type | Chunk Format | End Signal |
|----------|-------------|-------------|------------|
| Generic SSE | `text/event-stream` | `data: {"text":"chunk"}` | `data: [DONE]` |
| OpenAI | `text/event-stream` | `data: {"choices":[{"delta":{"content":"chunk"}}]}` | `data: [DONE]` |
| Anthropic | `text/event-stream` | `event: content_block_delta\ndata: {"delta":{"text":"chunk"}}` | `event: message_stop` |

## OpenAI Streaming Format

Used by: OpenAI SDK, Azure OpenAI, any OpenAI-compatible API (Groq, Together, etc.)

### Wire Format

```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### Frontend Consumption (OpenAI SDK)

```javascript
const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  process.stdout.write(content);
}
```

### Frontend Consumption (fetch + ReadableStream)

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // Parse SSE lines
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      const json = JSON.parse(line.slice(6));
      const content = json.choices?.[0]?.delta?.content;
      if (content) appendToChat(content);
    }
  }
}
```

### Mock Server Config

```json
{
  "responseType": "streaming",
  "streamingFormat": "openai",
  "streamingSpeed": 30,
  "fixture": "fixtures/step-1-stream.txt"
}
```

## Anthropic Streaming Format

Used by: Anthropic SDK, Claude API

### Wire Format

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_abc","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-20250514"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}

event: message_stop
data: {"type":"message_stop"}
```

### Frontend Consumption (Anthropic SDK)

```javascript
const stream = client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }]
});

stream.on('text', (text) => {
  appendToChat(text);
});

await stream.finalMessage();
```

### Mock Server Config

```json
{
  "responseType": "streaming",
  "streamingFormat": "anthropic",
  "streamingSpeed": 35,
  "fixture": "fixtures/step-1-stream.txt"
}
```

## Vercel AI SDK

The Vercel AI SDK (`ai` package) abstracts over multiple providers. It uses its own streaming protocol internally but consumes standard SSE from API routes.

### API Route (what the frontend calls)

```javascript
// app/api/chat/route.ts (Next.js)
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai('gpt-4'),
    messages
  });
  return result.toDataStreamResponse();
}
```

### Frontend Consumption

```javascript
import { useChat } from 'ai/react';

function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  // messages auto-update as streaming progresses
}
```

### Simulating Vercel AI SDK Streams

The Vercel AI SDK data stream format uses a custom protocol with type prefixes:

```
0:"Hello"
0:" world"
0:"!"
e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":5}}
d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":5}}
```

For projects using the Vercel AI SDK, the mock server should use `streamingFormat: "vercel-ai"` (if supported) or the underlying provider format that the API route would normally produce.

In practice, the simplest approach is often to mock at the API route level — since the route calls `streamText()` and returns `toDataStreamResponse()`, replacing the route with a mock that produces the same output format works well.

## Choosing the Right Format

1. **Check the frontend code** — what SDK or fetch pattern does it use?
2. **Check the API route** — what provider SDK does the backend call?
3. **Match the format** — use the corresponding `streamingFormat` in config

| Frontend Pattern | Likely Format |
|-----------------|---------------|
| `openai.chat.completions.create({ stream: true })` | `openai` |
| `client.messages.stream()` | `anthropic` |
| `useChat()` from `ai/react` | `openai` or `anthropic` (check API route) |
| Raw `fetch()` + `getReader()` | Check what the API returns |
| `EventSource` | `sse` (generic) |

## Tuning Streaming Speed

The `streamingSpeed` field controls characters per second. Guidelines:

| Speed | Effect | Good For |
|-------|--------|----------|
| 15-20 | Slow, dramatic | Emphasis on AI "thinking" |
| 25-35 | Natural reading pace | Most demos |
| 40-60 | Fast but visible | Long responses, tech-savvy audience |
| 80+ | Very fast | Brief responses, impatient audience |

The mock server sends ~10 chunks per second regardless of speed. The chunk size adjusts to hit the target chars/sec.

For a 2-minute demo, aim for responses that complete in 3-8 seconds each. Calculate:
- 500 chars at 30 chars/sec = ~17 seconds (too long for a quick demo)
- 200 chars at 40 chars/sec = ~5 seconds (good)
- 300 chars at 50 chars/sec = ~6 seconds (good)

Keep demo responses concise. Real LLM responses are often too verbose for a tight demo.
