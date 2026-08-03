#!/usr/bin/env node
/**
 * doc-ingest — document text extraction for harness file-search and analysis (v3.1.0).
 *
 * Extracts text from PDF, DOCX, XLSX, CSV, and image files using system-available tools.
 * Output goes to stdout (for piping) or to a temp file (for indexing).
 *
 * Extractor stack (falls back in order):
 *   PDF  → pdftotext (poppler-utils) → libreoffice --headless → python3+PyMuPDF
 *   DOCX → python3+python-docx → libreoffice --headless → unzip+grep
 *   XLSX → python3+openpyxl → libreoffice --headless → python3+csv
 *   CSV  → direct read (plain text)
 *   JPG/PNG/WEBP/GIF → Ollama vision model (llava/moondream2) describe
 *   TXT/MD → direct read (pass-through)
 *
 * Usage:
 *   node scripts/harness/doc-ingest.mjs --file report.pdf
 *   node scripts/harness/doc-ingest.mjs --file spreadsheet.xlsx --output-file /tmp/extracted.txt
 *   node scripts/harness/doc-ingest.mjs --file photo.png --vision-model llava
 *   node scripts/harness/doc-ingest.mjs probe                    # check available extractors
 *   npm run harness:doc:ingest -- --file report.pdf | npm run harness:file-index -- --root -
 *
 * Env:
 *   HARNESS_LLM_HOST     Ollama host for vision (default http://localhost:11434)
 *   HARNESS_VISION_MODEL Ollama vision model (default llava)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

const PLAIN_EXTS = new Set(['.txt', '.md', '.mjs', '.js', '.ts', '.py', '.sh', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.log', '.csv', '.xml', '.html', '.css', '.rs', '.go', '.java', '.rb', '.php', '.c', '.cpp', '.h']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_VISION_MODEL = process.env.HARNESS_VISION_MODEL || 'llava';
const OLLAMA_HOST = (process.env.HARNESS_LLM_HOST || process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Extractor availability probe
// ---------------------------------------------------------------------------

function which(cmd) {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function pythonHasModule(mod) {
  const r = spawnSync('python3', ['-c', `import ${mod}`], { encoding: 'utf8' });
  return r.status === 0;
}

function probeExtractors() {
  return {
    pdftotext: which('pdftotext'),
    libreoffice: which('libreoffice'),
    python3: which('python3'),
    'python3+PyMuPDF': which('python3') && pythonHasModule('fitz'),
    'python3+python-docx': which('python3') && pythonHasModule('docx'),
    'python3+openpyxl': which('python3') && pythonHasModule('openpyxl'),
    unzip: which('unzip'),
    ollamaVision: DEFAULT_VISION_MODEL,
    ollamaHost: OLLAMA_HOST,
  };
}

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

function extractPlain(filePath) {
  return readFileSync(filePath, 'utf8');
}

function extractPdf(filePath) {
  // Try pdftotext first (best quality)
  if (which('pdftotext')) {
    const r = spawnSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0 && r.stdout.trim()) return r.stdout;
  }
  // Fallback: libreoffice to txt
  if (which('libreoffice')) return extractViaLibreOffice(filePath, 'txt');
  // Fallback: PyMuPDF
  if (which('python3') && pythonHasModule('fitz')) {
    const r = spawnSync('python3', ['-c', `
import fitz, sys
doc = fitz.open(sys.argv[1])
print('\\n'.join(page.get_text() for page in doc))
`, filePath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0) return r.stdout;
  }
  throw new Error('No PDF extractor available. Install poppler-utils: sudo apt install poppler-utils');
}

function extractDocx(filePath) {
  if (which('python3') && pythonHasModule('docx')) {
    const r = spawnSync('python3', ['-c', `
import docx, sys
doc = docx.Document(sys.argv[1])
print('\\n'.join(p.text for p in doc.paragraphs))
`, filePath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0) return r.stdout;
  }
  if (which('libreoffice')) return extractViaLibreOffice(filePath, 'txt');
  // Last resort: unzip and extract document.xml text
  if (which('unzip')) {
    const r = spawnSync('unzip', ['-p', filePath, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0) {
      // Strip XML tags
      return r.stdout.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  throw new Error('No DOCX extractor available. Install python3-docx: pip3 install python-docx');
}

function extractXlsx(filePath) {
  if (which('python3') && pythonHasModule('openpyxl')) {
    const r = spawnSync('python3', ['-c', `
import openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
for sheet in wb.sheetnames:
    ws = wb[sheet]
    print(f"=== Sheet: {sheet} ===")
    for row in ws.iter_rows(values_only=True):
        print('\\t'.join(str(c) if c is not None else '' for c in row))
`, filePath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0) return r.stdout;
  }
  if (which('libreoffice')) return extractViaLibreOffice(filePath, 'csv');
  throw new Error('No XLSX extractor available. Install openpyxl: pip3 install openpyxl');
}

function extractViaLibreOffice(filePath, fmt) {
  const outDir = resolve(tmpdir(), `harness-lo-${randomUUID()}`);
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync('libreoffice', ['--headless', '--convert-to', fmt, '--outdir', outDir, filePath], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`libreoffice conversion failed: ${r.stderr}`);
  const base = basename(filePath, extname(filePath));
  const outFile = resolve(outDir, `${base}.${fmt}`);
  if (!existsSync(outFile)) throw new Error(`libreoffice did not produce ${outFile}`);
  return readFileSync(outFile, 'utf8');
}

async function extractImage(filePath, visionModel) {
  const stat = (await import('node:fs')).statSync(filePath);
  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large (${stat.size} bytes > ${MAX_IMAGE_BYTES} limit). Resize before ingesting.`);
  }
  const model = visionModel || DEFAULT_VISION_MODEL;
  const imageData = readFileSync(filePath).toString('base64');
  const ext = extname(filePath).slice(1).toLowerCase();
  const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  const mime = mimeMap[ext] || 'image/jpeg';

  const payload = {
    model,
    prompt: 'Describe this image in detail. Include all text visible, objects, layout, charts, tables, and any relevant information.',
    images: [imageData],
    stream: false,
  };

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Ollama vision request failed: HTTP ${response.status}. Is model "${model}" pulled? Run: ollama pull ${model}`);
  }
  const result = await response.json();
  return result.response || '';
}

// ---------------------------------------------------------------------------
// Main extractor dispatcher
// ---------------------------------------------------------------------------

async function extractText(filePath, options = {}) {
  const ext = extname(filePath).toLowerCase();

  if (PLAIN_EXTS.has(ext)) return extractPlain(filePath);
  if (ext === '.pdf') return extractPdf(filePath);
  if (ext === '.docx' || ext === '.doc') return extractDocx(filePath);
  if (ext === '.xlsx' || ext === '.xls' || ext === '.ods') return extractXlsx(filePath);
  if (IMAGE_EXTS.has(ext)) return extractImage(filePath, options.visionModel);

  // Unknown extension — try as plain text, fall back gracefully
  try { return extractPlain(filePath); } catch {
    throw new Error(`Unsupported file type: ${ext}. Supported: pdf, docx, xlsx, images (jpg/png/gif/webp), plain text.`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { flags._.push(arg); continue; }
    if (arg === '--help') { flags.help = true; continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i += 1; } else { flags[key] = true; }
  }
  return flags;
}

function showHelp() {
  process.stdout.write(JSON.stringify({
    usage: 'node scripts/harness/doc-ingest.mjs --file <path> [options]',
    description: 'Extract text from PDF, DOCX, XLSX, images, and plain text files. Output to stdout for piping into file-search / vector-search.',
    flags: {
      '--file <path>': 'File to extract text from (required)',
      '--output-file <path>': 'Write extracted text to file instead of stdout',
      '--vision-model <name>': `Ollama vision model for images (default: ${DEFAULT_VISION_MODEL})`,
      '--json': 'Wrap output in JSON {ok, file, ext, words, text}',
    },
    commands: {
      'probe': 'Check which extractors are available on this system',
    },
    extractors: {
      'pdf': 'pdftotext (poppler-utils) → libreoffice → PyMuPDF',
      'docx': 'python3+python-docx → libreoffice → unzip+xml-strip',
      'xlsx': 'python3+openpyxl → libreoffice',
      'images': 'Ollama vision model (llava / moondream2)',
      'text/plain': 'direct read',
    },
    ubuntu_setup: [
      'sudo apt install poppler-utils libreoffice-common',
      'pip3 install python-docx openpyxl',
      'ollama pull llava',
    ],
    examples: [
      'node scripts/harness/doc-ingest.mjs probe',
      'node scripts/harness/doc-ingest.mjs --file report.pdf',
      'node scripts/harness/doc-ingest.mjs --file invoice.xlsx --json',
      'node scripts/harness/doc-ingest.mjs --file diagram.png --vision-model moondream',
      'npm run harness:doc:ingest -- --file slides.pdf --output-file /tmp/slides.txt',
    ],
  }, null, 2) + '\n');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags._[0];

  if (flags.help) { showHelp(); return; }

  if (command === 'probe') {
    const probes = probeExtractors();
    process.stdout.write(JSON.stringify({ ok: true, extractors: probes }, null, 2) + '\n');
    return;
  }

  if (!flags.file) {
    process.stderr.write('[doc-ingest] --file is required. Run --help for usage.\n');
    process.exit(2);
  }

  const filePath = resolve(flags.file);
  if (!existsSync(filePath)) {
    process.stderr.write(`[doc-ingest] File not found: ${filePath}\n`);
    process.exit(2);
  }

  let text;
  try {
    text = await extractText(filePath, { visionModel: flags['vision-model'] });
  } catch (err) {
    process.stderr.write(`[doc-ingest] Extraction failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  if (flags['output-file']) {
    const outPath = resolve(flags['output-file']);
    writeFileSync(outPath, text, 'utf8');
    process.stdout.write(JSON.stringify({ ok: true, file: filePath, outputFile: outPath, ext: extname(filePath), words: wordCount }, null, 2) + '\n');
    return;
  }

  if (flags.json) {
    process.stdout.write(JSON.stringify({ ok: true, file: filePath, ext: extname(filePath), words: wordCount, text }, null, 2) + '\n');
    return;
  }

  process.stdout.write(text);
}

main().catch(err => {
  process.stderr.write(`[doc-ingest] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
