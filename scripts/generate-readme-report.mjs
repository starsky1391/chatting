import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const readmePath = path.join(root, 'README.md');
const outPath = path.join(root, 'docs', 'readme.html');
const markdown = fs.readFileSync(readmePath, 'utf8').replace(/^\uFEFF/, '');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_#[\]().]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function inline(text) {
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.9em] text-neutral-800">$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-medium text-neutral-950">$1</strong>');
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-neutral-950 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900" href="$2">$1</a>');
  return escaped;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderLines(lines) {
  const html = [];
  let i = 0;
  let paragraph = [];
  let listType = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p class="mb-6 leading-relaxed text-neutral-600">${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  }

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      const lang = fence[1] || '';
      const body = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      if (lang === 'mermaid') {
        html.push(`<div class="my-8 rounded-lg border border-neutral-100 bg-neutral-50 p-5 md:p-8"><pre class="mermaid">${escapeHtml(body.join('\n'))}</pre></div>`);
      } else {
        html.push(`<div class="my-6"><div class="rounded-t-lg bg-neutral-800 px-4 py-2 font-mono text-xs text-neutral-400">${lang || 'code'}</div><pre class="overflow-x-auto rounded-b-lg bg-[#171717] p-4 text-sm leading-relaxed text-neutral-100"><code>${escapeHtml(body.join('\n'))}</code></pre></div>`);
      }
      i += 1;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      if (level === 3) {
        html.push(`<h3 id="${id}" class="mb-5 mt-10 text-lg font-medium tracking-tight text-neutral-950">${inline(text)}</h3>`);
      } else if (level >= 4) {
        html.push(`<h4 id="${id}" class="mb-3 mt-8 text-sm font-medium text-neutral-500">${inline(text)}</h4>`);
      }
      i += 1;
      continue;
    }

    if (i + 1 < lines.length && line.includes('|') && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      closeList();
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      html.push('<div class="my-8 overflow-x-auto rounded-lg border border-neutral-200"><table class="min-w-[920px] w-full text-xs leading-snug">');
      html.push(`<thead><tr class="border-b border-neutral-200 bg-neutral-50">${headers.map((h) => `<th class="whitespace-nowrap px-2.5 py-2 text-left font-medium text-neutral-500">${inline(h)}</th>`).join('')}</tr></thead>`);
      html.push('<tbody>');
      for (const row of rows) {
        html.push(`<tr class="border-b border-neutral-100 last:border-0">${row.map((cell) => `<td class="whitespace-nowrap px-2.5 py-2 align-top text-neutral-600">${inline(cell)}</td>`).join('')}</tr>`);
      }
      html.push('</tbody></table></div>');
      continue;
    }

    const unordered = line.match(/^\s*-\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push(`<${listType} class="mb-8 space-y-3 text-neutral-600">`);
      }
      html.push(`<li class="flex gap-3 leading-relaxed"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300"></span><span>${inline((unordered || ordered)[1].trim())}</span></li>`);
      i += 1;
      continue;
    }

    closeList();
    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph();
  closeList();
  return html.join('\n');
}

function splitSections(md) {
  const lines = md.split(/\r?\n/);
  let title = 'Chatting 实时聊天系统';
  const sections = [];
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      if (current) current.lines.push(line);
      continue;
    }
    if (!inFence) {
      const h1 = line.match(/^#\s+(.+)$/);
      if (h1) {
        title = h1[1].trim();
        continue;
      }
      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        if (current) sections.push(current);
        current = { title: h2[1].trim(), lines: [] };
        continue;
      }
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return { title, sections };
}

const { title, sections } = splitSections(markdown);

const sectionHtml = sections.map((section, index) => {
  const id = slugify(section.title);
  return `<section id="${id}" class="animate-section border-t border-neutral-100 py-16">
    <span class="mb-4 block font-mono text-xs tracking-widest text-neutral-300">${String(index + 1).padStart(2, '0')}</span>
    <h2 class="mb-8 text-2xl font-semibold tracking-tight text-neutral-950">${inline(section.title)}</h2>
    ${renderLines(section.lines)}
  </section>`;
}).join('\n');

const tocHtml = sections.map((section, index) => (
  `<a href="#${slugify(section.title)}" class="block rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950"><span class="mr-3 font-mono text-xs text-neutral-300">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(section.title)}</a>`
)).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - 技术报告</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'monospace']
          }
        }
      }
    }
  </script>
  <style>
    :root {
      --paper: #f3e6d4;
      --paper-soft: #fbf5ec;
      --paper-card: #fffaf3;
      --ink: #2b211a;
      --muted: #7c6a58;
      --line: #dec8ad;
      --line-soft: #eadbc8;
      --coffee: #4a2f20;
      --caramel: #b9783b;
      --sage: #5f745f;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-section { animation: fadeIn 0.6s ease-out forwards; }
    html { scroll-behavior: smooth; }
    body {
      background:
        linear-gradient(90deg, rgba(74, 47, 32, 0.035) 1px, transparent 1px),
        linear-gradient(rgba(74, 47, 32, 0.03) 1px, transparent 1px),
        var(--paper);
      background-size: 44px 44px, 44px 44px, auto;
      color: var(--ink);
    }
    header {
      background:
        linear-gradient(180deg, #e4c6a2 0%, rgba(243, 230, 212, 0.88) 76%, rgba(243, 230, 212, 0) 100%);
      border-bottom: 1px solid rgba(74, 47, 32, 0.08);
    }
    main > div {
      background: rgba(255, 250, 243, 0.66);
      box-shadow: 0 0 0 1px rgba(222, 200, 173, 0.5);
      padding-inline: clamp(0px, 3vw, 44px);
    }
    section { border-color: var(--line-soft) !important; }
    pre.mermaid { background: transparent; color: var(--ink); }
    .mermaid svg { max-width: 100%; height: auto; }
    .bg-white, .bg-neutral-50 { background-color: var(--paper-card) !important; }
    .bg-neutral-100 { background-color: #eadbc8 !important; }
    .bg-neutral-800, .bg-neutral-900, .bg-neutral-950 { background-color: var(--coffee) !important; }
    .text-neutral-950, .text-neutral-900 { color: var(--ink) !important; }
    .text-neutral-800 { color: #3c2a20 !important; }
    .text-neutral-600, .text-neutral-500 { color: var(--muted) !important; }
    .text-neutral-400, .text-neutral-300 { color: #a58b70 !important; }
    .border-neutral-100, .border-neutral-200 { border-color: var(--line-soft) !important; }
    .decoration-neutral-300 { text-decoration-color: #bf9d79 !important; }
    .hover\\:decoration-neutral-900:hover { text-decoration-color: var(--coffee) !important; }
    .hover\\:bg-neutral-50:hover { background-color: #efe0cc !important; }
    .hover\\:text-neutral-950:hover { color: var(--coffee) !important; }
    .shadow-sm { box-shadow: 0 18px 50px rgba(74, 47, 32, 0.08) !important; }
    a.bg-neutral-950 {
      background: var(--coffee) !important;
      color: #fffaf3 !important;
    }
    a.bg-neutral-950:hover { background: #6a432d !important; }
    .bg-blue-50 {
      background-color: #eef2e7 !important;
      border-color: #c7d2ba !important;
    }
    .text-blue-800 { color: #405640 !important; }
    @media print {
      .no-print { display: none !important; }
      section { break-inside: avoid; }
      body { color: #111; }
    }
  </style>
</head>
<body class="text-[#2b211a] antialiased">
  <nav class="no-print fixed right-6 top-6 z-20 hidden max-h-[calc(100vh-3rem)] w-64 overflow-auto rounded-xl border border-neutral-100 bg-white/90 p-3 shadow-sm backdrop-blur xl:block">
    <p class="mb-2 px-3 font-mono text-xs uppercase tracking-widest text-neutral-300">Contents</p>
    ${tocHtml}
  </nav>

  <header class="flex min-h-[70vh] flex-col justify-center px-6 py-24">
    <div class="mx-auto w-full max-w-[720px]">
      <p class="mb-4 text-sm uppercase tracking-widest text-neutral-400">Technical Report</p>
      <h1 class="mb-8 text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
        ${escapeHtml(title)}
        <br>
        <span class="text-neutral-500">README 生成版项目报告</span>
      </h1>
      <p class="max-w-xl text-xl leading-relaxed text-neutral-600">这份文档基于 <strong class="font-medium text-[#1a1a1a]">README.md</strong> 生成，并按技术报告形式重新组织：先说明系统能力，再呈现部署、数据模型和演进原因。</p>
      <div class="mt-12 flex flex-wrap items-center gap-4 text-sm text-neutral-400">
        <span>实时通信</span><span class="h-1 w-1 rounded-full bg-neutral-300"></span>
        <span>私信与好友</span><span class="h-1 w-1 rounded-full bg-neutral-300"></span>
        <span>语音频道</span><span class="h-1 w-1 rounded-full bg-neutral-300"></span>
        <span>Docker 部署</span>
      </div>
    </div>
  </header>

  <main class="px-6 pb-32">
    <div class="mx-auto max-w-[720px]">
      ${sectionHtml}
      <footer class="border-t border-neutral-100 py-16 text-center">
        <p class="text-sm text-neutral-400">Generated from README.md. Style adapted from the provided technical report sample.</p>
      </footer>
    </div>
  </main>

  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
  </script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log(outPath);
