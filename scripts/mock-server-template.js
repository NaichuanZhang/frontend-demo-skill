/**
 * Demo Mock Server Template
 *
 * A lightweight Express server that serves pre-recorded API responses
 * for hackathon demo recordings. Supports three response types:
 *
 * 1. Static JSON — returns canned response with optional delay
 * 2. Streaming (SSE) — drip-feeds text at configurable speed
 * 3. WebSocket — replays scripted message sequences
 *
 * Configuration is driven entirely by demo-config.json and fixture files.
 *
 * Usage:
 *   Copy this file to your demo/ folder as server.js
 *   Ensure demo-config.json and fixtures/ are in the same directory
 *   Run: node server.js
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(__dirname, 'demo-config.json');
if (!fs.existsSync(configPath)) {
  console.error('Error: demo-config.json not found in', __dirname);
  console.error('Make sure you are running this from the demo/ directory.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const PORT = config.server?.port || 3001;
const CORS_ORIGIN = config.server?.corsOrigin || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Track which step we're on (for sequential mode)
let currentStepIndex = 0;

// ─── Route Registration ─────────────────────────────────────────────────────

// Group steps by endpoint + method for route matching
const routeMap = new Map();

for (const step of config.steps) {
  const key = `${step.method || 'POST'}:${step.endpoint}`;
  if (!routeMap.has(key)) {
    routeMap.set(key, []);
  }
  routeMap.get(key).push(step);
}

// Register routes
for (const [key, steps] of routeMap) {
  const [method, endpoint] = key.split(':');
  const httpMethod = method.toLowerCase();

  app[httpMethod](endpoint, async (req, res) => {
    // Find the right step: use request body matching or sequential order
    let step = steps.length === 1
      ? steps[0]
      : findMatchingStep(steps, req.body) || steps[Math.min(currentStepIndex, steps.length - 1)];

    console.log(`[Step ${step.id}] ${method} ${endpoint} → ${step.responseType} (${step.fixture})`);

    // Apply delay before responding
    const delay = step.delay || 0;
    if (delay > 0) {
      await sleep(delay);
    }

    // Serve based on response type
    switch (step.responseType) {
      case 'streaming':
        await handleStreaming(req, res, step);
        break;
      case 'websocket':
        // WebSocket is handled separately below
        res.status(400).json({ error: 'This endpoint uses WebSocket, not HTTP' });
        break;
      case 'static':
      default:
        await handleStatic(req, res, step);
        break;
    }

    currentStepIndex++;
  });
}

// ─── Static Response Handler ────────────────────────────────────────────────

async function handleStatic(req, res, step) {
  const fixturePath = path.join(__dirname, step.fixture);

  if (!fs.existsSync(fixturePath)) {
    console.error(`  Fixture not found: ${fixturePath}`);
    return res.status(500).json({ error: `Fixture not found: ${step.fixture}` });
  }

  const content = fs.readFileSync(fixturePath, 'utf-8');

  try {
    const json = JSON.parse(content);
    res.json(json);
  } catch {
    // If not valid JSON, return as text
    res.type('text/plain').send(content);
  }
}

// ─── Streaming (SSE) Response Handler ───────────────────────────────────────

async function handleStreaming(req, res, step) {
  const fixturePath = path.join(__dirname, step.fixture);

  if (!fs.existsSync(fixturePath)) {
    console.error(`  Fixture not found: ${fixturePath}`);
    return res.status(500).json({ error: `Fixture not found: ${step.fixture}` });
  }

  const content = fs.readFileSync(fixturePath, 'utf-8');
  const charsPerSecond = step.streamingSpeed || 30;
  const chunkSize = Math.max(1, Math.round(charsPerSecond / 10)); // Send ~10 chunks/sec
  const intervalMs = 100; // 100ms between chunks

  // Detect streaming format from config or default to SSE
  const format = step.streamingFormat || 'sse';

  if (format === 'openai') {
    // OpenAI-compatible streaming format
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let offset = 0;
    const id = `chatcmpl-demo-${step.id}`;

    while (offset < content.length) {
      const chunk = content.slice(offset, offset + chunkSize);
      const data = JSON.stringify({
        id,
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: { content: chunk },
          finish_reason: null
        }]
      });
      res.write(`data: ${data}\n\n`);
      offset += chunkSize;
      await sleep(intervalMs);
    }

    // Send final chunk with finish_reason
    const finalData = JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    });
    res.write(`data: ${finalData}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } else if (format === 'anthropic') {
    // Anthropic-compatible streaming format
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send message_start
    res.write(`event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: { id: `msg_demo_${step.id}`, type: 'message', role: 'assistant', content: [], model: 'demo', stop_reason: null }
    })}\n\n`);

    // Send content_block_start
    res.write(`event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' }
    })}\n\n`);

    let offset = 0;
    while (offset < content.length) {
      const chunk = content.slice(offset, offset + chunkSize);
      res.write(`event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: chunk }
      })}\n\n`);
      offset += chunkSize;
      await sleep(intervalMs);
    }

    // Send stop events
    res.write(`event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`);
    res.write(`event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } })}\n\n`);
    res.write(`event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
    res.end();

  } else {
    // Generic SSE format
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let offset = 0;
    while (offset < content.length) {
      const chunk = content.slice(offset, offset + chunkSize);
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      offset += chunkSize;
      await sleep(intervalMs);
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  }

  console.log(`  Streamed ${content.length} chars at ${charsPerSecond} chars/sec`);
}

// ─── WebSocket Support ──────────────────────────────────────────────────────

function setupWebSocket(server) {
  const wsSteps = config.steps.filter(s => s.responseType === 'websocket');
  if (wsSteps.length === 0) return;

  let WebSocket;
  try {
    WebSocket = require('ws');
  } catch {
    console.warn('Warning: ws package not installed. WebSocket steps will not work.');
    console.warn('Run: npm install ws');
    return;
  }

  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');

    ws.on('message', (message) => {
      const data = message.toString();
      console.log(`[WebSocket] Received: ${data}`);

      // Find matching WebSocket step
      const step = wsSteps.find(s => {
        if (!s.requestMatch) return true;
        try {
          const parsed = JSON.parse(data);
          return Object.entries(s.requestMatch).every(([k, v]) => parsed[k] === v);
        } catch {
          return data.includes(s.requestMatch);
        }
      });

      if (step) {
        replayWebSocketMessages(ws, step);
      }
    });
  });
}

async function replayWebSocketMessages(ws, step) {
  const fixturePath = path.join(__dirname, step.fixture);

  if (!fs.existsSync(fixturePath)) {
    console.error(`  WebSocket fixture not found: ${fixturePath}`);
    return;
  }

  const messages = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  for (const msg of messages) {
    await sleep(msg.delay || 100);
    const payload = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);
    ws.send(payload);
    console.log(`  [WebSocket] Sent: ${payload.slice(0, 80)}${payload.length > 80 ? '...' : ''}`);
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findMatchingStep(steps, body) {
  if (!body || Object.keys(body).length === 0) return null;

  return steps.find(step => {
    if (!step.requestMatch) return false;
    return Object.entries(step.requestMatch).every(([key, value]) => {
      if (typeof value === 'string') {
        return String(body[key]).toLowerCase().includes(value.toLowerCase());
      }
      return body[key] === value;
    });
  });
}

// ─── Reset Endpoint ─────────────────────────────────────────────────────────

app.post('/__demo/reset', (req, res) => {
  currentStepIndex = 0;
  console.log('[Demo] Reset to step 0');
  res.json({ status: 'reset', currentStep: 0 });
});

app.get('/__demo/status', (req, res) => {
  res.json({
    currentStep: currentStepIndex,
    totalSteps: config.steps.length,
    steps: config.steps.map(s => ({
      id: s.id,
      description: s.description,
      endpoint: s.endpoint,
      responseType: s.responseType
    }))
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`\n  Demo Mock Server running on http://localhost:${PORT}`);
  console.log(`  Loaded ${config.steps.length} demo step(s):\n`);
  for (const step of config.steps) {
    const type = step.responseType === 'streaming'
      ? `streaming @ ${step.streamingSpeed || 30} chars/sec`
      : step.responseType;
    console.log(`    Step ${step.id}: ${step.method || 'POST'} ${step.endpoint} [${type}]`);
    console.log(`      → ${step.description}`);
  }
  console.log(`\n  Reset: POST http://localhost:${PORT}/__demo/reset`);
  console.log(`  Status: GET http://localhost:${PORT}/__demo/status\n`);
});

// Set up WebSocket if needed
setupWebSocket(server);
