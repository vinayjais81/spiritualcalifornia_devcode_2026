import MarkdownIt from 'markdown-it';
import { normalizePostContent } from './postContent';

/**
 * Renders imported editorial articles.
 *
 * `html: false` is the security boundary and is not optional. Article bodies
 * come from a content package rather than the app, so raw HTML is escaped
 * rather than passed through — that removes the need for a separate sanitiser
 * pass before dangerouslySetInnerHTML. Verified against the delivered content:
 * all 124 articles are pure Markdown with zero raw HTML tags, so nothing is
 * lost by refusing it.
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false, // the house style uses `--` deliberately; leave it alone
  breaks: false,
});

/**
 * External links open in a new tab with rel="noopener noreferrer", per §5 of the
 * style spec. Internal links (/journal/…) stay in-app so client-side navigation
 * still works — the ~700 citations are external, the 255 cross-links are not.
 */
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx].attrGet('href') ?? '');
  const isInternal = href.startsWith('/') || href.startsWith('#');

  if (!isInternal) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  tokens[idx].attrJoin('class', 'journal-link');

  return defaultLinkOpen(tokens, idx, options, env, self);
};

// Class contract from 01-STYLE-SPEC.md §5, so article styling is driven by the
// shared stylesheet rather than inline rules.
md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  if (tokens[idx].tag === 'h2') tokens[idx].attrJoin('class', 'journal-article__h2');
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.blockquote_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrJoin('class', 'journal-pullquote');
  return self.renderToken(tokens, idx, options);
};

/**
 * One entry point for both kinds of post.
 *
 * Guide posts are HTML from the dashboard editor (and some legacy rows are
 * Tiptap JSON, which normalizePostContent repairs). Imported articles are
 * Markdown. `contentFormat` on the row says which, so nothing has to sniff the
 * content at render time.
 */
export function renderArticleBody(
  content: string,
  contentFormat?: 'HTML' | 'MARKDOWN' | null,
): string {
  if (contentFormat === 'MARKDOWN') return md.render(content);
  return normalizePostContent(content);
}

/** Word-count read time, used when the article carries no authored `readTime`. */
export function estimateReadTime(html: string): string {
  const words = html.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}
