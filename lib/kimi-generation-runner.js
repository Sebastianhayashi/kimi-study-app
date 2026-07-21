const { spawn } = require('child_process');
const crypto = require('crypto');
const {
  sanitizeProgressReport,
  mapToolCall,
  mapToolResult,
  mapWireEvent,
} = require('./public-generation-event');

const PROGRESS_TOOL = {
  name: 'report_generation_progress',
  description: 'Report a real, learner-facing course generation phase only when that work actually starts or reaches a verified checkpoint. Never advance phases for animation. Never include private reasoning, answers, grading keys, shell commands, or internal paths. Terminal completion is reported by the host after files are verified.',
  parameters: {
    type: 'object',
    properties: {
      phase: {
        type: 'string',
        enum: ['extracting', 'profiling', 'claims', 'blueprint', 'questions', 'quality', 'assembling', 'validating'],
      },
      message: { type: 'string', maxLength: 80 },
      detail: { type: 'string', maxLength: 180 },
      metrics: {
        type: 'object',
        properties: {
          units: { type: 'integer', minimum: 0 },
          claims: { type: 'integer', minimum: 0 },
          candidates: { type: 'integer', minimum: 0 },
          accepted: { type: 'integer', minimum: 0 },
          rejected: { type: 'integer', minimum: 0 },
          lessonNumber: { type: 'integer', minimum: 0 },
        },
      },
    },
    required: ['phase', 'message'],
  },
};

function unavailable(message, cause) {
  const error = new Error(message);
  error.code = 'KIMI_WIRE_UNAVAILABLE';
  error.canFallback = true;
  error.cause = cause;
  return error;
}

function createLineParser(onLine) {
  let buffer = '';
  return {
    push(chunk) {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) onLine(line);
      }
    },
    flush() {
      const line = buffer.trim();
      buffer = '';
      if (line) onLine(line);
    },
  };
}

function runWire({ cwd, prompt, cont, model, skillsDir, onEvent = () => {}, spawnImpl = spawn, initializeTimeoutMs = 12000 }) {
  return new Promise((resolve, reject) => {
    const args = ['--wire', '--auto', '-m', model, '--skills-dir', skillsDir];
    if (cont) args.push('--continue');
    const child = spawnImpl('kimi', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const initializeId = crypto.randomUUID();
    const promptId = crypto.randomUUID();
    const calls = new Map();
    let promptStarted = false;
    let settled = false;
    let stderr = '';
    let text = '';
    let initializeTimer = null;

    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(initializeTimer);
      if (error) reject(error);
      else resolve(result);
    };
    const startPrompt = () => {
      if (promptStarted) return;
      promptStarted = true;
      send({ jsonrpc: '2.0', method: 'prompt', id: promptId, params: { user_input: prompt } });
    };

    function respondToRequest(message) {
      const request = message.params || {};
      const payload = request.payload || {};
      if (request.type === 'ToolCallRequest' && payload.name === PROGRESS_TOOL.name) {
        const event = sanitizeProgressReport(payload.arguments);
        onEvent(event);
        send({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tool_call_id: payload.id,
            return_value: {
              is_error: false,
              output: 'Progress recorded.',
              message: 'Progress recorded.',
              display: [],
            },
          },
        });
        return;
      }
      if (request.type === 'ApprovalRequest') {
        send({
          jsonrpc: '2.0',
          id: message.id,
          result: { request_id: payload.id, response: 'approve' },
        });
        return;
      }
      if (request.type === 'QuestionRequest') {
        send({
          jsonrpc: '2.0',
          id: message.id,
          result: { request_id: payload.id, answers: {} },
        });
        return;
      }
      send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32601, message: `Unsupported request type: ${request.type || 'unknown'}` },
      });
    }

    function handle(message) {
      if (message.id === initializeId) {
        if (message.error && message.error.code !== -32601) {
          child.kill('SIGTERM');
          finish(unavailable(`Kimi Wire initialize failed: ${message.error.message || 'unknown error'}`));
          return;
        }
        startPrompt(); // -32601 means an older Wire server; prompt is still supported.
        return;
      }
      if (message.id === promptId) {
        if (message.error) {
          finish(new Error(message.error.message || 'Kimi Wire prompt failed'));
          return;
        }
        const status = message.result && message.result.status;
        child.stdin.end();
        setTimeout(() => { if (!child.killed) child.kill('SIGTERM'); }, 800).unref?.();
        finish(null, { text: text.trim(), status: status || 'finished', mode: 'wire' });
        return;
      }
      if (message.method === 'request' && message.id) {
        respondToRequest(message);
        return;
      }
      if (message.method !== 'event' || !message.params) return;
      const { type, payload } = message.params;
      if (type === 'ContentPart' && payload && payload.type === 'text') text += payload.text || '';
      const event = mapWireEvent(type, payload, calls);
      if (event) onEvent(event);
    }

    const parser = createLineParser((line) => {
      try { handle(JSON.parse(line)); } catch {}
    });
    child.stdout.on('data', (chunk) => parser.push(chunk));
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
    child.on('error', (error) => finish(unavailable(`Unable to start Kimi Wire: ${error.message}`, error)));
    child.on('close', (code) => {
      parser.flush();
      if (settled) return;
      const message = stderr.trim() || `Kimi Wire exited with code ${code}`;
      finish(promptStarted ? new Error(message) : unavailable(message));
    });

    initializeTimer = setTimeout(() => {
      if (promptStarted || settled) return;
      child.kill('SIGTERM');
      finish(unavailable('Kimi Wire initialize timed out'));
    }, initializeTimeoutMs);

    send({
      jsonrpc: '2.0',
      method: 'initialize',
      id: initializeId,
      params: {
        protocol_version: '1.10',
        client: { name: 'kimi-study', version: '1.0.0' },
        capabilities: { supports_question: false, supports_plan_mode: false },
        external_tools: [PROGRESS_TOOL],
      },
    });
  });
}

function runStreamJson({ cwd, prompt, cont, model, skillsDir, onEvent = () => {}, spawnImpl = spawn }) {
  return new Promise((resolve, reject) => {
    const args = ['-m', model, '--skills-dir', skillsDir];
    if (cont) args.push('-c');
    args.push('-p', prompt, '--output-format', 'stream-json');
    const child = spawnImpl('kimi', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const calls = new Map();
    let text = '';
    let stderr = '';
    let structured = false;

    onEvent({ kind: 'compatibility', key: 'mode:stream-json', state: 'active', message: '正在通过兼容事件模式创建课程…' });

    const parser = createLineParser((line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      structured = true;
      if (message.role === 'assistant') {
        if (typeof message.content === 'string') text += message.content;
        for (const toolCall of message.tool_calls || []) {
          const mapped = mapToolCall(toolCall);
          if (mapped.call.id) calls.set(mapped.call.id, mapped.call);
          onEvent(mapped.event);
        }
      } else if (message.role === 'tool') {
        onEvent(mapToolResult({
          tool_call_id: message.tool_call_id,
          return_value: { is_error: Boolean(message.is_error), output: message.content || '', message: '', display: [] },
        }, calls.get(message.tool_call_id)));
      }
    });

    child.stdout.on('data', (chunk) => parser.push(chunk));
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-12000); });
    child.on('error', (error) => {
      error.canFallback = true;
      reject(error);
    });
    child.on('close', (code) => {
      parser.flush();
      if (code === 0) resolve({ text: text.trim(), status: 'finished', mode: 'stream-json' });
      else {
        const error = new Error(stderr.trim() || `Kimi stream-json exited with code ${code}`);
        error.canFallback = !structured;
        reject(error);
      }
    });
  });
}

function runPlain({ cwd, prompt, cont, model, skillsDir, onEvent = () => {}, spawnImpl = spawn }) {
  return new Promise((resolve, reject) => {
    const args = ['-m', model, '--skills-dir', skillsDir];
    if (cont) args.push('-c');
    args.push('-p', prompt);
    const child = spawnImpl('kimi', args, { cwd });
    let out = '';
    let err = '';
    onEvent({ kind: 'compatibility', key: 'mode:files', state: 'active', message: '正在创建课程；当前环境将通过生成文件更新进度…' });
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err = `${err}${chunk}`.slice(-12000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ text: out, status: 'finished', mode: 'text' });
      else reject(new Error(err || `kimi exit ${code}`));
    });
  });
}

async function runTrackedKimi(options) {
  try {
    return await runWire(options);
  } catch (error) {
    if (!error.canFallback) throw error;
  }
  try {
    return await runStreamJson(options);
  } catch (error) {
    if (!error.canFallback) throw error;
  }
  return runPlain(options);
}

module.exports = {
  PROGRESS_TOOL,
  createLineParser,
  runWire,
  runStreamJson,
  runPlain,
  runTrackedKimi,
};
