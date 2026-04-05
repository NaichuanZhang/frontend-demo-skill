# demo-config.json Schema

The `demo-config.json` file defines the demo flow and server configuration. It lives in the root of the `demo/` folder.

## Full Schema

```json
{
  "steps": [
    {
      "id": 1,
      "description": "Human-readable description of this demo step",
      "userAction": "What the person does during the demo",
      "endpoint": "/api/chat",
      "method": "POST",
      "requestMatch": { "message": "specific text to match" },
      "responseType": "streaming",
      "fixture": "fixtures/step-1-stream.txt",
      "streamingSpeed": 30,
      "streamingFormat": "openai",
      "delay": 200
    }
  ],
  "server": {
    "port": 3001,
    "corsOrigin": "*"
  }
}
```

## Field Reference

### Step Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | number | yes | — | Sequential step identifier |
| `description` | string | yes | — | What happens in this step (for logging and README) |
| `userAction` | string | no | — | What the human does (for demo README) |
| `endpoint` | string | yes | — | API route path (e.g., `/api/chat`) |
| `method` | string | no | `"POST"` | HTTP method |
| `requestMatch` | object | no | — | Match request body fields to route to correct fixture |
| `responseType` | string | yes | — | `"static"`, `"streaming"`, or `"websocket"` |
| `fixture` | string | yes | — | Path to fixture file (relative to demo/) |
| `streamingSpeed` | number | no | `30` | Characters per second (streaming only) |
| `streamingFormat` | string | no | `"sse"` | `"sse"`, `"openai"`, or `"anthropic"` |
| `delay` | number | no | `0` | Milliseconds before response starts |

### Server Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `port` | number | no | `3001` | Port for the mock server |
| `corsOrigin` | string | no | `"*"` | CORS origin setting |

## Response Types

### Static (`"static"`)

Returns a JSON or text fixture as-is after the configured delay.

**Fixture format:** `.json` file with the complete response body.

```json
{
  "id": "trip-123",
  "status": "saved",
  "message": "Trip saved successfully"
}
```

### Streaming (`"streaming"`)

Drip-feeds text content as Server-Sent Events at the configured speed.

**Fixture format:** `.txt` file with the raw text content to stream.

```
Here's your 5-day Tokyo itinerary:

**Day 1: Arrival & Shibuya**
Arrive at Narita Airport and take the Narita Express to Shibuya...
```

**Streaming formats:**

- `"sse"` — Generic SSE: `data: {"text": "chunk"}\n\n`
- `"openai"` — OpenAI-compatible: `data: {"choices":[{"delta":{"content":"chunk"}}]}\n\n`
- `"anthropic"` — Anthropic-compatible: `event: content_block_delta\ndata: {"delta":{"text":"chunk"}}\n\n`

Choose the format that matches the SDK your frontend uses.

### WebSocket (`"websocket"`)

Replays a scripted sequence of WebSocket messages.

**Fixture format:** `.json` file with an array of messages.

```json
[
  {
    "delay": 100,
    "data": { "type": "status", "message": "Processing..." }
  },
  {
    "delay": 500,
    "data": { "type": "result", "content": "Analysis complete" }
  },
  {
    "delay": 100,
    "data": { "type": "done" }
  }
]
```

## Request Matching

When multiple steps share the same endpoint, use `requestMatch` to route requests to the correct fixture:

```json
{
  "steps": [
    {
      "id": 1,
      "endpoint": "/api/chat",
      "method": "POST",
      "requestMatch": { "message": "tokyo" },
      "fixture": "fixtures/step-1-tokyo.txt",
      "responseType": "streaming"
    },
    {
      "id": 2,
      "endpoint": "/api/chat",
      "method": "POST",
      "requestMatch": { "message": "restaurants" },
      "fixture": "fixtures/step-2-restaurants.txt",
      "responseType": "streaming"
    }
  ]
}
```

The server matches request body fields using case-insensitive substring matching for strings. If no match is found, it falls back to sequential step order.

## Examples

### Simple Chat App

```json
{
  "steps": [
    {
      "id": 1,
      "description": "User asks about Tokyo trip planning",
      "userAction": "Types 'Plan my trip to Tokyo' and presses Enter",
      "endpoint": "/api/chat",
      "method": "POST",
      "responseType": "streaming",
      "streamingFormat": "openai",
      "fixture": "fixtures/step-1-stream.txt",
      "streamingSpeed": 40,
      "delay": 300
    },
    {
      "id": 2,
      "description": "User saves the trip plan",
      "userAction": "Clicks 'Save Trip' button",
      "endpoint": "/api/trips",
      "method": "POST",
      "responseType": "static",
      "fixture": "fixtures/step-2-response.json",
      "delay": 150
    }
  ],
  "server": {
    "port": 3001
  }
}
```

### Real-time Collaboration App

```json
{
  "steps": [
    {
      "id": 1,
      "description": "User loads document list",
      "endpoint": "/api/documents",
      "method": "GET",
      "responseType": "static",
      "fixture": "fixtures/step-1-documents.json"
    },
    {
      "id": 2,
      "description": "Collaborator edits arrive via WebSocket",
      "endpoint": "/ws",
      "responseType": "websocket",
      "fixture": "fixtures/step-2-edits.json"
    }
  ],
  "server": {
    "port": 3001
  }
}
```
