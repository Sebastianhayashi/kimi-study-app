'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { renderCanvasArtifactExportMarkdown } = require('./canvas-artifact-export');

const MAX_PROCESS_OUTPUT = 256 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
]);

function requiredText(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function defaultResolveExecutable(name) {
  const executable = requiredText(name, 'Executable name');
  const searchPath = String(process.env.PATH || '');
  const candidates = searchPath.split(path.delimiter).filter(Boolean);
  for (const root of candidates) {
    const candidate = path.join(root, executable);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

function boundedAppend(current, chunk) {
  if (current.length >= MAX_PROCESS_OUTPUT) return current;
  return `${current}${String(chunk)}`.slice(0, MAX_PROCESS_OUTPUT);
}

function defaultRunProcess({ command, args, cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout = boundedAppend(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = boundedAppend(stderr, chunk); });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: Number.isInteger(code) ? code : 1,
        signal: signal || null,
        stdout,
        stderr: signal === 'SIGKILL' ? `${stderr}\nPDF engine timed out after ${timeoutMs}ms.`.trim() : stderr,
      });
    });
  });
}

function createPandocCanvasPdfRenderer({
  evidenceStore,
  pandocBinary = null,
  xelatexBinary = null,
  resolveExecutable = defaultResolveExecutable,
  runProcess = defaultRunProcess,
  tempRoot = os.tmpdir(),
  timeoutMs = 30_000,
  fontFamily = process.env.LUCUBRO_PDF_FONT_FAMILY || 'Noto Sans CJK SC',
  margin = '18mm',
} = {}) {
  if (!evidenceStore || typeof evidenceStore.get !== 'function' || typeof evidenceStore.readContent !== 'function') {
    throw new Error('Pandoc Canvas PDF renderer requires EvidenceStore');
  }
  if (typeof resolveExecutable !== 'function') throw new Error('Pandoc Canvas PDF renderer resolveExecutable must be a function');
  if (typeof runProcess !== 'function') throw new Error('Pandoc Canvas PDF renderer runProcess must be a function');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Pandoc Canvas PDF renderer timeoutMs must be a positive integer');
  const normalizedFontFamily = requiredText(fontFamily, 'Pandoc Canvas PDF fontFamily');
  const normalizedMargin = requiredText(margin, 'Pandoc Canvas PDF margin');
  fs.mkdirSync(tempRoot, { recursive: true });

  function available() {
    const pandoc = pandocBinary || resolveExecutable('pandoc');
    if (!pandoc) {
      return { available: false, reason: 'Required PDF engine executable is unavailable: pandoc' };
    }
    const xelatex = xelatexBinary || resolveExecutable('xelatex');
    if (!xelatex) {
      return { available: false, reason: 'Required PDF engine executable is unavailable: xelatex' };
    }
    return {
      available: true,
      pandoc,
      xelatex,
      fontFamily: normalizedFontFamily,
    };
  }

  function materializeFigures(document, rootDir) {
    const assetPaths = new Map();
    const assetsDir = path.join(rootDir, 'assets');

    for (const block of document.blocks || []) {
      if (!block || block.type !== 'figure' || block.embeddingEligibility !== 'embed') continue;
      const evidenceId = requiredText(block.evidenceId, 'PDF figure Evidence id');
      const evidence = evidenceStore.get(evidenceId);
      if (!evidence) throw new Error(`PDF figure Evidence not found: ${evidenceId}`);
      if (evidence.workId !== document.workId) throw new Error(`PDF figure Evidence must belong to the owning Work: ${evidenceId}`);
      const extension = IMAGE_EXTENSIONS.get(String(evidence.mimeType || '').toLowerCase());
      if (!extension) continue;
      fs.mkdirSync(assetsDir, { recursive: true });
      const filename = `${evidenceId}${extension}`;
      fs.writeFileSync(path.join(assetsDir, filename), evidenceStore.readContent(evidenceId));
      assetPaths.set(evidenceId, `assets/${filename}`);
    }

    return assetPaths;
  }

  async function render(document) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('Canvas Artifact ExportDocument is required for PDF rendering');
    requiredText(document.artifactId, 'Canvas Artifact export artifactId');
    requiredText(document.workId, 'Canvas Artifact export workId');
    const engine = available();
    if (!engine.available) throw new Error(engine.reason);

    const rootDir = fs.mkdtempSync(path.join(tempRoot, 'lucubro-canvas-pdf-'));
    try {
      const assetPaths = materializeFigures(document, rootDir);
      const markdown = renderCanvasArtifactExportMarkdown(document, {
        figurePathFor(block) {
          return assetPaths.get(block.evidenceId) || null;
        },
      });
      fs.writeFileSync(path.join(rootDir, 'artifact.md'), markdown, 'utf8');

      const args = [
        'artifact.md',
        '-o',
        'artifact.pdf',
        `--pdf-engine=${engine.xelatex}`,
        '-V',
        `mainfont=${normalizedFontFamily}`,
        '-V',
        `geometry:margin=${normalizedMargin}`,
      ];
      const result = await runProcess({
        command: engine.pandoc,
        args,
        cwd: rootDir,
        timeoutMs,
      });
      if (!result || result.code !== 0) {
        const detail = String(result && result.stderr || result && result.stdout || 'PDF engine failed').trim();
        throw new Error(`Canvas Artifact PDF engine failed: ${detail || `exit ${result && result.code}`}`);
      }

      const outputPath = path.join(rootDir, 'artifact.pdf');
      if (!fs.existsSync(outputPath)) throw new Error('Canvas Artifact PDF engine did not create artifact.pdf');
      const bytes = fs.readFileSync(outputPath);
      if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new Error('Canvas Artifact PDF engine returned invalid PDF bytes');
      }
      return bytes;
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  }

  return {
    available,
    render,
  };
}

module.exports = {
  createPandocCanvasPdfRenderer,
  defaultResolveExecutable,
  defaultRunProcess,
};
