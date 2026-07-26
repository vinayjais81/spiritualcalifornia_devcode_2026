/**
 * Blog post body normalisation.
 *
 * `BlogPost.content` is *supposed* to be HTML — that's what the Tiptap editor
 * emits (`editor.getHTML()`) and what every renderer feeds to
 * `dangerouslySetInnerHTML`. But some seeded rows were written as stringified
 * Tiptap/ProseMirror JSON (`{"type":"doc","content":[…]}`), which rendered as
 * raw JSON on the public journal page.
 *
 * The seed now emits HTML for every post, but rows created by an older seed
 * still live in the QA/prod databases, so readers stay defensive: detect the
 * JSON shape and serialise it to HTML, otherwise pass the value through
 * untouched.
 */

interface PMNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: PMNode[];
}

/** Escape text taken from JSON — it has never been through the editor's sanitiser. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap a text node in its marks (bold/italic/code/link). */
function applyMarks(text: string, marks: PMNode['marks']): string {
  if (!marks?.length) return text;
  return marks.reduce((acc, mark) => {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        return `<strong>${acc}</strong>`;
      case 'italic':
      case 'em':
        return `<em>${acc}</em>`;
      case 'code':
        return `<code>${acc}</code>`;
      case 'link': {
        const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
        // Only http(s) — blocks javascript: and data: URLs from seeded JSON.
        if (!/^https?:\/\//i.test(href)) return acc;
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${acc}</a>`;
      }
      default:
        return acc;
    }
  }, text);
}

function serialiseNodes(nodes: PMNode[] | undefined): string {
  if (!Array.isArray(nodes)) return '';
  return nodes.map(serialiseNode).join('');
}

function serialiseNode(node: PMNode): string {
  if (!node || typeof node !== 'object') return '';

  if (node.type === 'text') {
    return applyMarks(escapeHtml(node.text ?? ''), node.marks);
  }

  const inner = serialiseNodes(node.content);

  switch (node.type) {
    case 'doc':
      return inner;
    case 'heading': {
      // Clamp to h2–h4 so post bodies never emit a second <h1>.
      const raw = Number(node.attrs?.level ?? 2);
      const level = Math.min(4, Math.max(2, Number.isFinite(raw) ? raw : 2));
      return `<h${level}>${inner}</h${level}>`;
    }
    case 'paragraph':
      return `<p>${inner}</p>`;
    case 'blockquote':
      return `<blockquote>${inner}</blockquote>`;
    case 'bulletList':
      return `<ul>${inner}</ul>`;
    case 'orderedList':
      return `<ol>${inner}</ol>`;
    case 'listItem':
      return `<li>${inner}</li>`;
    case 'codeBlock':
      return `<pre><code>${inner}</code></pre>`;
    case 'hardBreak':
      return '<br />';
    case 'horizontalRule':
      return '<hr />';
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
      if (!/^https?:\/\//i.test(src)) return '';
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
    }
    default:
      // Unknown block — keep the text so no copy is silently dropped.
      return inner ? `<p>${inner}</p>` : '';
  }
}

/**
 * Return post body HTML, converting legacy Tiptap JSON when encountered.
 * Anything that isn't a well-formed ProseMirror doc is returned unchanged.
 */
export function normalizePostContent(raw: string | null | undefined): string {
  if (!raw) return '';

  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return raw;

  try {
    const doc = JSON.parse(trimmed) as PMNode;
    if (doc?.type === 'doc' && Array.isArray(doc.content)) {
      return serialiseNodes(doc.content);
    }
  } catch {
    /* not JSON after all — fall through and treat as HTML */
  }

  return raw;
}
