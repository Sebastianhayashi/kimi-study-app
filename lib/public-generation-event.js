const path = require('path');

const PHASES = new Set([
  'extracting',
  'profiling',
  'claims',
  'blueprint',
  'questions',
  'quality',
  'assembling',
  'validating',
  'complete',
]);

const PHASE_VARIANT = {
  extracting: 'material',
  profiling: 'structure',
  claims: 'claims',
  blueprint: 'practice',
  questions: 'questions',
  quality: 'quality',
  assembling: 'assembly',
  validating: 'validation',
  complete: 'ready',
};

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function parseArguments(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function collectStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

function artifactFromArguments(value) {
  const strings = collectStrings(parseArguments(value));
  const known = [
    'source-profile.json',
    'learning-claims.json',
    'assessment-blueprint.json',
    'misconceptions.json',
    'question-bank.json',
    'quality-report.json',
    'map.json',
  ];
  for (const item of strings) {
    const normalized = item.replace(/\\/g, '/');
    const exact = known.find((name) => normalized.endsWith(name));
    if (exact) return exact;
    if (/\/(lessons|assessments)\/[^/]+\.(html|json)$/i.test(normalized)) {
      const parts = normalized.split('/');
      return `${parts[parts.length - 2]}/${path.basename(normalized)}`;
    }
  }
  return null;
}

function artifactPhase(artifact) {
  if (!artifact) return null;
  if (artifact === 'source-profile.json') return 'profiling';
  if (artifact === 'learning-claims.json') return 'claims';
  if (artifact === 'assessment-blueprint.json' || artifact === 'misconceptions.json') return 'blueprint';
  if (artifact === 'question-bank.json') return 'questions';
  if (artifact === 'quality-report.json') return 'quality';
  if (artifact.startsWith('lessons/') || artifact === 'map.json') return 'assembling';
  if (artifact.startsWith('assessments/')) return 'validating';
  return null;
}

function artifactMessage(artifact, complete = false) {
  const verb = complete ? '已完成' : '正在写入';
  if (artifact === 'source-profile.json') return complete ? '材料结构分析已经完成' : '正在整理材料结构和章节关系…';
  if (artifact === 'learning-claims.json') return complete ? '学习目标已经确定' : '正在保存可验证的学习目标…';
  if (artifact === 'assessment-blueprint.json') return complete ? '练习路线已经设计完成' : '正在设计引导练习和独立练习…';
  if (artifact === 'misconceptions.json') return complete ? '常见误区已经整理完成' : '正在整理学习者可能出现的误区…';
  if (artifact === 'question-bank.json') return complete ? '候选题库已经生成' : '正在生成并整理候选题…';
  if (artifact === 'quality-report.json') return complete ? '题目质量检查已经完成' : '正在检查题目的材料依据和重复情况…';
  if (artifact.startsWith('lessons/')) return complete ? '课节页面已经组装完成' : '正在组装课节讲解、示范和练习…';
  if (artifact.startsWith('assessments/')) return complete ? '互动练习规格已经写入' : '正在写入答案、提示和评分规则…';
  if (artifact === 'map.json') return complete ? '课程学习地图已经更新' : '正在更新课程学习地图…';
  return `${verb}课程文件…`;
}

function isWriteTool(name) {
  return /(write|edit|patch|save|create)/i.test(String(name || ''));
}

function isPreflightToolCall(name, value) {
  if (!/(shell|bash|exec|python)/i.test(String(name || ''))) return false;
  return collectStrings(parseArguments(value))
    .some((item) => String(item).replace(/\\/g, '/').includes('next-lesson-preflight.js'));
}

function sanitizeProgressReport(input) {
  const args = parseArguments(input);
  const phase = PHASES.has(args.phase) ? args.phase : 'assembling';
  const metrics = {};
  for (const key of ['units', 'claims', 'candidates', 'accepted', 'rejected', 'lessonNumber']) {
    const value = safeInteger(args.metrics && args.metrics[key]);
    if (value !== undefined) metrics[key] = value;
  }
  return {
    kind: phase === 'complete' ? 'run-progress' : 'phase',
    key: `phase:${phase}`,
    phase,
    canvasVariant: PHASE_VARIANT[phase],
    state: phase === 'complete' ? 'complete' : 'active',
    message: clip(args.message, 80) || '正在创建课程…',
    detail: clip(args.detail, 180) || undefined,
    metrics,
  };
}

function toolDetails(payload) {
  const tool = payload && payload.function ? payload.function : {};
  const name = String(tool.name || 'tool');
  const preflight = isPreflightToolCall(name, tool.arguments);
  const artifact = isWriteTool(name) ? artifactFromArguments(tool.arguments) : null;
  return { id: payload && payload.id, name, artifact, preflight };
}

function mapToolCall(payload) {
  const call = toolDetails(payload);
  if (call.preflight) {
    return {
      event: {
        kind: 'preflight',
        key: `tool:${call.id || `${call.name}:${Date.now()}`}`,
        toolCallId: call.id,
        phase: 'validating',
        canvasVariant: PHASE_VARIANT.validating,
        state: 'active',
        message: '正在运行下一课发布预检…',
      },
      call,
    };
  }
  const lower = call.name.toLowerCase();
  const phase = artifactPhase(call.artifact);
  let message = '正在执行课程生成步骤…';
  if (call.artifact) message = artifactMessage(call.artifact, false);
  else if (/(read|fetch|search|grep|glob|list)/.test(lower)) message = '正在定位并阅读与本课相关的材料…';
  else if (/(write|edit|patch|save)/.test(lower)) message = '正在组装课程内容和活动文件…';
  else if (/(shell|bash|exec|python)/.test(lower)) message = '正在处理教材内容和课程资源…';
  else if (/(task|subagent|delegate)/.test(lower)) message = '正在并行分析课程内容…';
  return {
    event: {
      kind: call.artifact ? 'artifact' : 'tool',
      key: `tool:${call.id || `${call.name}:${Date.now()}`}`,
      toolCallId: call.id,
      phase: phase || undefined,
      canvasVariant: phase ? PHASE_VARIANT[phase] : undefined,
      state: 'active',
      message,
      artifact: call.artifact || undefined,
    },
    call,
  };
}

function mapToolResult(payload, call) {
  const failed = Boolean(payload && payload.return_value && payload.return_value.is_error);
  if (call && call.preflight) {
    return {
      kind: 'preflight',
      key: `tool:${payload && payload.tool_call_id}`,
      toolCallId: payload && payload.tool_call_id,
      phase: 'validating',
      canvasVariant: PHASE_VARIANT.validating,
      state: failed ? 'error' : 'complete',
      message: failed ? '下一课发布预检未通过，正在修正…' : '下一课发布预检已通过',
    };
  }
  const artifact = call && call.artifact;
  const phase = artifactPhase(artifact);
  return {
    kind: artifact ? 'artifact' : 'tool',
    key: `tool:${payload && payload.tool_call_id}`,
    toolCallId: payload && payload.tool_call_id,
    phase: phase || undefined,
    canvasVariant: phase ? PHASE_VARIANT[phase] : undefined,
    state: failed ? 'error' : 'complete',
    message: failed
      ? '当前生成步骤遇到问题，Kimi 正在调整方案…'
      : artifact ? artifactMessage(artifact, true) : '一个课程生成步骤已经完成',
    artifact: artifact || undefined,
  };
}

function mapWireEvent(type, payload, calls = new Map()) {
  if (type === 'ContentPart') return null; // Never expose raw text or ThinkPart as product progress.
  if (type === 'StepRetry') {
    return {
      kind: 'retry',
      key: `retry:${payload.n}:${payload.next_attempt}`,
      state: 'active',
      message: `当前步骤遇到连接问题，${Math.max(0, Number(payload.wait_s) || 0)} 秒后自动重试…`,
    };
  }
  if (type === 'ToolCall') {
    const mapped = mapToolCall(payload);
    if (mapped.call.id) calls.set(mapped.call.id, mapped.call);
    return mapped.event;
  }
  if (type === 'ToolResult') {
    const call = calls.get(payload && payload.tool_call_id);
    return mapToolResult(payload, call);
  }
  if (type === 'SubagentEvent' && payload && payload.event) {
    return mapWireEvent(payload.event.type, payload.event.payload, calls);
  }
  return null;
}

module.exports = {
  PHASE_VARIANT,
  sanitizeProgressReport,
  artifactFromArguments,
  mapToolCall,
  mapToolResult,
  mapWireEvent,
};
