package dev.recing.web.llm;

import java.util.regex.Pattern;

/**
 * Reduces raw HTML/text content for LLM prompting.
 * Strips noise, preserves recipe-relevant elements, and caps output size.
 */
public final class RecipeContentReducer {

    private static final Pattern SCRIPT_EXCEPT_JSONLD = Pattern.compile(
        "<script(?![^>]*type\\s*=\\s*[\"']application/ld\\+json[\"'])[^>]*>.*?</script>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE
    );
    private static final Pattern STYLE_TAGS = Pattern.compile("<style[^>]*>.*?</style>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern HTML_COMMENTS = Pattern.compile("<!--.*?-->", Pattern.DOTALL);
    private static final Pattern SVG_TAGS = Pattern.compile("<svg[^>]*>.*?</svg>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

    /** Result of reducing content. */
    public record ReducedContent(
        String text,
        int originalLength,
        int reducedLength,
        boolean truncated
    ) {}

    private RecipeContentReducer() {}

    /**
     * Reduces raw HTML or text by stripping noise and capping length.
     *
     * @param content the raw page content (HTML or plain text)
     * @param maxChars maximum characters to keep after reduction
     * @return reduced content metadata
     */
    public static ReducedContent reduce(String content, int maxChars) {
        if (content == null || content.isBlank()) {
            return new ReducedContent("", 0, 0, false);
        }

        String text = content;
        int originalLength = text.length();

        // Strip <script> tags except JSON-LD recipe blocks
        text = SCRIPT_EXCEPT_JSONLD.matcher(text).replaceAll("");
        // Strip style tags
        text = STYLE_TAGS.matcher(text).replaceAll("");
        // Strip HTML comments
        text = HTML_COMMENTS.matcher(text).replaceAll("");
        // Strip SVG blocks
        text = SVG_TAGS.matcher(text).replaceAll("");

        // Extract title if present (for passing to LLM prompt)
        java.util.regex.Matcher titleMatcher = Pattern.compile("<title[^>]*>(.*?)</title>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE).matcher(content);
        String title = null;
        if (titleMatcher.find()) {
            title = titleMatcher.group(1).trim();
            if (title.isEmpty()) title = null;
        }

        // Remove remaining HTML tags but preserve line breaks and list structure
        text = stripHtmlTags(text);

        // Collapse whitespace
        text = collapseWhitespace(text);

        // Cap at maxChars
        boolean truncated = text.length() > maxChars;
        if (truncated) {
            text = text.substring(0, maxChars);
            // Don't cut mid-word: find last space and trim back
            int lastSpace = text.lastIndexOf(' ');
            if (lastSpace > maxChars / 2) {
                text = text.substring(0, lastSpace).trim();
            }
        }

        return new ReducedContent(text, originalLength, text.length(), truncated);
    }

    /** Extract title from raw HTML content. Returns null if not found or empty. */
    public static String extractTitle(String html) {
        if (html == null || !html.contains("<title")) return null;
        java.util.regex.Matcher m = Pattern.compile("<title[^>]*>(.*?)</title>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE).matcher(html);
        if (m.find()) {
            String title = m.group(1).trim();
            return title.isEmpty() ? null : title;
        }
        return null;
    }

    private static String stripHtmlTags(String html) {
        // Keep <br>, <li>, and basic line structure for readability
        html = html.replaceAll("<br\\s*/?>", "\n");
        html = html.replaceAll("</?li[^>]*>", "  - ");
        html = html.replaceAll("</?[pP][^>]*>", "\n");
        html = html.replaceAll("</?[hH][1-6][^>]*>", "\n---\n");
        // Remove all remaining tags
        return html.replaceAll("<[^>]+>", "");
    }

    private static String collapseWhitespace(String text) {
        // Replace multiple whitespace/newlines with single space, then clean up
        return text.replaceAll("[\\s]+", " ").trim();
    }
}
