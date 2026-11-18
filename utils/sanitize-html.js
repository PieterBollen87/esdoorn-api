// utils/sanitize-html.js
// Small whitelist sanitizer for the message editor's HTML.
// Keeps only simple formatting (incl. h3 for small headings like "Opgelet:"); every other tag and attribute is dropped.

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'a', 'span', 'p', 'br', 'div', 'h3']);
const VOID_TAGS = new Set(['br']);
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function escapeAttr(value) {
  return String(value)
    .replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&amp;/gi, '&');
}

function parseAttrs(str) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(str))) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function buildOpenTag(name, attrs) {
  if (name === 'a') {
    // Remove whitespace/control chars before checking the protocol (blocks "java\nscript:")
    const href = decodeEntities(attrs.href || '').replace(/[\u0000- ]/g, '');
    if (!href || !SAFE_URL.test(href)) return '<a>';
    const external = /^https?:\/\//i.test(href);
    return `<a href="${escapeAttr(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>`;
  }
  if (name === 'span') {
    const classes = (attrs.class || '').split(/\s+/);
    return classes.includes('hl') ? '<span class="hl">' : '<span>';
  }
  return VOID_TAGS.has(name) ? `<${name}>` : `<${name}>`;
}

function sanitizeHtml(input) {
  if (typeof input !== 'string') return '';

  // Drop dangerous elements together with their content, and comments
  let html = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|template|noscript)\b[^>]*>/gi, '');

  let out = '';
  const re = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*|\/)?>/g;
  let last = 0;
  let m;
  while ((m = re.exec(html))) {
    // Text before this tag: neutralize any stray angle brackets
    out += html.slice(last, m.index).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    last = re.lastIndex;

    const closing = !!m[1];
    const name = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;           // drop tag, keep its text
    if (closing) { if (!VOID_TAGS.has(name)) out += `</${name}>`; continue; }
    out += buildOpenTag(name, parseAttrs(m[3] || ''));
  }
  out += html.slice(last).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return out.trim();
}

/** True when the HTML contains no visible text */
function isEmptyHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

module.exports = { sanitizeHtml, isEmptyHtml };
