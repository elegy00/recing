/**
 * Reduces raw HTML/text content for LLM prompting.
 * Strips noise, preserves recipe-relevant elements, and caps output size.
 */

export interface ReducedContent {
  text: string;
  originalLength: number;
  reducedLength: number;
  truncated: boolean;
}

const SCRIPT_EXCEPT_JSONLD =
  /<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>.*?<\/script>/gis;
const STYLE_TAGS = /<style[^>]*>.*?<\/style>/gis;
const HTML_COMMENTS = /<!--.*?-->/gs;
const SVG_TAGS = /<svg[^>]*>.*?<\/svg>/gis;
const TITLE_TAG = /<title[^>]*>(.*?)<\/title>/gis;

/**
 * Reduces raw HTML or text by stripping noise and capping length.
 */
export function reduce(content: string | null | undefined, maxChars: number): ReducedContent {
  if (!content || content.trim().length === 0) {
    return { text: "", originalLength: 0, reducedLength: 0, truncated: false };
  }

  let text = content;
  const originalLength = text.length;

  // Strip <script> tags except JSON-LD recipe blocks
  text = text.replace(SCRIPT_EXCEPT_JSONLD, "");
  // Strip style tags
  text = text.replace(STYLE_TAGS, "");
  // Strip HTML comments
  text = text.replace(HTML_COMMENTS, "");
  // Strip SVG blocks
  text = text.replace(SVG_TAGS, "");

  // Remove remaining HTML tags but preserve line breaks and list structure
  text = stripHtmlTags(text);

  // Collapse whitespace
  text = collapseWhitespace(text);

  // Cap at maxChars — don't cut mid-word
  let truncated = text.length > maxChars;
  if (truncated) {
    text = text.substring(0, maxChars);
    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace > maxChars / 2) {
      text = text.substring(0, lastSpace).trim();
    } else {
      text = text.trimEnd();
    }
  }

  return { text, originalLength, reducedLength: text.length, truncated };
}

/** Extract title from raw HTML content. Returns null if not found or empty. */
export function extractTitle(html: string | null | undefined): string | null {
  if (!html || !html.includes("<title")) return null;
  const match = TITLE_TAG.exec(html);
  if (match) {
    const title = match[1].trim();
    return title.length > 0 ? title : null;
  }
  return null;
}

/** Strip remaining HTML tags while preserving structure for readability. */
function stripHtmlTags(html: string): string {
  // Convert structural tags to whitespace markers
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<\/?li[^>]*>/g, "  - ");
  html = html.replace(/<\/?[pP][^>]*>/g, "\n");
  html = html.replace(/<\/?[hH][1-6][^>]*>/g, "\n---\n");
  // Remove all remaining tags
  return html.replace(/<[^>]+>/g, "");
}

/** Collapse multiple whitespace/newlines into single spaces. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
