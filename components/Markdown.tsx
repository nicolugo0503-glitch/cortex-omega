"use client";

/**
 * Tiny markdown renderer. Avoids pulling in a full library —
 * we only need code blocks, inline code, bold/italic, and lists.
 * Each rendered block is HTML-escaped before formatting markers
 * are applied, so untrusted model output cannot inject HTML.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(s: string): string {
  // bold **x**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // italic *x* (avoid touching bold remnants — bold ran first)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  // inline code `x`
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  return s;
}

function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  let out = "";
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];

    // fenced code block
    const fence = ln.match(/^```([a-zA-Z0-9_-]*)?$/);
    if (fence) {
      let code = "";
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code += escapeHtml(lines[i]) + "\n";
        i++;
      }
      i++;
      out += `<pre><code>${code}</code></pre>`;
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(ln)) {
      out += "<ul>";
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*[-*]\s+/, "");
        out += `<li>${renderInline(escapeHtml(item))}</li>`;
        i++;
      }
      out += "</ul>";
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(ln)) {
      out += "<ol>";
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*\d+\.\s+/, "");
        out += `<li>${renderInline(escapeHtml(item))}</li>`;
        i++;
      }
      out += "</ol>";
      continue;
    }

    // blank line → paragraph break
    if (!ln.trim()) {
      i++;
      continue;
    }

    // collect paragraph
    let para = ln;
    i++;
    while (i < lines.length && lines[i].trim() && !/^(```|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) {
      para += "\n" + lines[i];
      i++;
    }
    out += `<p>${renderInline(escapeHtml(para))}</p>`;
  }
  return out;
}

export function Markdown({ text }: { text: string }) {
  return <div className="text" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}
