// Safe Markdown renderer for Tutor messages. It escapes source text first and never executes raw HTML.
(() => {
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const safeUrl = (value) => {
    try {
      const url = new URL(String(value), location.origin);
      return /^(https?:|mailto:)$/.test(url.protocol) ? url.href : '#';
    } catch {
      return '#';
    }
  };

  function inline(source) {
    const code = [];
    let text = escapeHtml(source).replace(/`([^`]+)`/g, (_, value) => {
      const index = code.push(`<code>${value}</code>`) - 1;
      return `\u0000CODE${index}\u0000`;
    });

    text = text
      .replace(/\[([^\]]+)]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
        const url = safeUrl(href.replace(/&amp;/g, '&'));
        return url === '#' ? label : `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    return text.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => code[Number(index)] || '');
  }

  const isFence = (line) => /^\s*```/.test(line);
  const isHeading = (line) => /^\s*#{1,4}\s+/.test(line);
  const isQuote = (line) => /^\s*>\s?/.test(line);
  const isList = (line) => /^\s*(?:[-+*]|\d+[.)、])\s+/.test(line);
  const isRule = (line) => /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isTableDivider = (line) => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  function tableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
  }

  function render(source) {
    const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
    const output = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) { index += 1; continue; }

      if (isFence(line)) {
        const language = trimmed.slice(3).trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
        const body = [];
        index += 1;
        while (index < lines.length && !isFence(lines[index])) body.push(lines[index++]);
        if (index < lines.length) index += 1;
        output.push(`<pre><code${language ? ` class="language-${language}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`);
        continue;
      }

      const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = Math.min(4, heading[1].length + 1);
        output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (isRule(line)) {
        output.push('<hr>');
        index += 1;
        continue;
      }

      if (isTableRow(line) && isTableDivider(lines[index + 1] || '')) {
        const head = tableCells(line);
        index += 2;
        const rows = [];
        while (index < lines.length && isTableRow(lines[index])) rows.push(tableCells(lines[index++]));
        output.push(`<div class="ks-markdown-table-wrap"><table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${head.map((_, cellIndex) => `<td>${inline(row[cellIndex] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }

      if (isQuote(line)) {
        const quote = [];
        while (index < lines.length && isQuote(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
        output.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
        continue;
      }

      if (isList(line)) {
        const ordered = /^\s*\d+[.)、]\s+/.test(line);
        const tag = ordered ? 'ol' : 'ul';
        const items = [];
        while (index < lines.length) {
          const current = lines[index];
          const currentOrdered = /^\s*\d+[.)、]\s+/.test(current);
          if (!isList(current) || currentOrdered !== ordered) break;
          items.push(current.replace(/^\s*(?:[-+*]|\d+[.)、])\s+/, ''));
          index += 1;
        }
        output.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
        continue;
      }

      const paragraph = [trimmed];
      index += 1;
      while (index < lines.length) {
        const next = lines[index];
        if (!next.trim()) { index += 1; break; }
        if (isFence(next) || isHeading(next) || isQuote(next) || isList(next) || isRule(next)
          || (isTableRow(next) && isTableDivider(lines[index + 1] || ''))) break;
        paragraph.push(next.trim());
        index += 1;
      }
      output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }

    return output.join('');
  }

  window.KimiAssistantMarkdown = Object.freeze({ render });
})();
