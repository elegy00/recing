package dev.recing.web.llm;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RecipeContentReducerTest {

    @Test
    void stripsScriptTags() {
        String input = "<html><body><script>alert('xss')</script>Hello</body></html>";
        var result = RecipeContentReducer.reduce(input, 100);
        assertFalse(result.text().contains("alert"));
        assertTrue(result.text().contains("Hello"));
    }

    @Test
    void preservesJsonLdScript() {
        String input = """
            <html><body>
            <script type="application/ld+json">{"@context":"schema.org"}</script>
            <p>Recipe content</p>
            </body></html>""";
        var result = RecipeContentReducer.reduce(input, 100);
        assertTrue(result.text().contains("schema.org") || result.text().contains("@context"));
    }

    @Test
    void stripsStyleTags() {
        String input = "<html><head><style>.foo{color:red}</style></head><body>Hello</body></html>";
        var result = RecipeContentReducer.reduce(input, 100);
        assertFalse(result.text().contains("color"));
        assertTrue(result.text().contains("Hello"));
    }

    @Test
    void stripsHtmlComments() {
        String input = "<!-- hidden -->Visible content<!-- another comment -->";
        var result = RecipeContentReducer.reduce(input, 100);
        assertFalse(result.text().contains("hidden"));
        assertTrue(result.text().contains("Visible content"));
    }

    @Test
    void capsContentLength() {
        String input = "A".repeat(200);
        var result = RecipeContentReducer.reduce(input, 50);
        assertTrue(result.truncated());
        assertEquals(50, result.reducedLength());
    }

    @Test
    void doesNotTruncateWhenUnderLimit() {
        String input = "Short content";
        var result = RecipeContentReducer.reduce(input, 200);
        assertFalse(result.truncated());
    }

    @Test
    void extractsTitleFromHtml() {
        String html = "<html><head><title>My Awesome Recipe</title></head><body>...</body></html>";
        String title = RecipeContentReducer.extractTitle(html);
        assertEquals("My Awesome Recipe", title);
    }

    @Test
    void returnsNullForMissingTitle() {
        assertNull(RecipeContentReducer.extractTitle("<html><body>No title tag</body></html>"));
    }

    @Test
    void handlesEmptyInput() {
        var result = RecipeContentReducer.reduce("", 100);
        assertEquals(0, result.originalLength());
        assertEquals(0, result.reducedLength());
        assertFalse(result.truncated());
    }

    @Test
    void handlesNullInput() {
        var result = RecipeContentReducer.reduce(null, 100);
        assertEquals("", result.text());
    }

    @Test
    void preservesListStructure() {
        String input = "<ul><li>Flour</li><li>Sugar</li></ul>";
        var result = RecipeContentReducer.reduce(input, 200);
        assertTrue(result.text().contains("Flour"));
        assertTrue(result.text().contains("Sugar"));
    }

    @Test
    void preservesHeadings() {
        String input = "<h1>Ingredients</h1><p>Stuff</p>";
        var result = RecipeContentReducer.reduce(input, 200);
        assertTrue(result.text().contains("Ingredients"));
    }
}
