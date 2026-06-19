package dev.recing.web.job;

import dev.recing.web.llm.RecipeExtraction;
import dev.recing.web.llm.RecipeIngredient;
import dev.recing.web.llm.RecipeInstruction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JobSubmissionTest {

    private JobSubmission job;

    @BeforeEach
    void setUp() {
        job = new JobSubmission();
    }

    // --- Getters / setters ---

    @Test
    void all_fields_accessible_via_getters_setters() {
        String id = "test-id";
        String url = "http://example.com/recipe";
        Instant now = Instant.now();
        RecipeExtraction result = new RecipeExtraction(
            "v1", "extracted", "Pancakes", "", "", "", "", "", "", "", "",
            java.util.List.of(), java.util.List.of(), null
        );

        job.setId(id);
        job.setUrl(url);
        job.setStatus(JobStatus.COMPLETED);
        job.setCreatedAt(now);
        job.setUpdatedAt(now.minusSeconds(1));
        job.setResult(result);
        job.setError("something went wrong");

        assertEquals(id, job.getId());
        assertEquals(url, job.getUrl());
        assertEquals(JobStatus.COMPLETED, job.getStatus());
        assertEquals(now, job.getCreatedAt());
        assertEquals(now.minusSeconds(1), job.getUpdatedAt());
        assertSame(result, job.getResult());
        assertEquals("something went wrong", job.getError());
    }

    // --- Constructor defaults ---

    @Test
    void default_values_are_null() {
        JobSubmission fresh = new JobSubmission();
        assertNull(fresh.getId());
        assertNull(fresh.getUrl());
        assertNull(fresh.getStatus());
        assertNull(fresh.getCreatedAt());
        assertNull(fresh.getUpdatedAt());
        assertNull(fresh.getResult());
        assertNull(fresh.getError());
    }

    // --- Enum transitions ---

    @Test
    void status_can_transition_from_pending_to_processing() {
        job.setStatus(JobStatus.PENDING);
        assertEquals(JobStatus.PENDING, job.getStatus());

        job.setStatus(JobStatus.PROCESSING);
        assertEquals(JobStatus.PROCESSING, job.getStatus());
    }

    @Test
    void status_can_transition_from_processing_to_completed() {
        job.setStatus(JobStatus.PROCESSING);
        job.setStatus(JobStatus.COMPLETED);
        assertEquals(JobStatus.COMPLETED, job.getStatus());
    }

    @Test
    void status_can_transition_from_processing_to_failed() {
        job.setStatus(JobStatus.PROCESSING);
        job.setStatus(JobStatus.FAILED);
        assertEquals(JobStatus.FAILED, job.getStatus());
    }

    // --- isValid pattern (via RecipeExtraction) ---

    @Test
    void result_extraction_is_valid_when_populated() {
        RecipeExtraction extraction = new RecipeExtraction(
            "v1", "extracted", "Pancakes", "", "", "", "", "", "", "", "",
            java.util.List.of(), java.util.List.of(), null
        );
        // status is "extracted" but ingredients/instructions empty → not valid
        assertFalse(extraction.isValid());

        RecipeExtraction good = new RecipeExtraction(
            "v1", "extracted", "Pancakes", "", "", "", "", "", "", "", "",
            java.util.List.of(new RecipeIngredient("", "cup", "flour", "white", null)),
            java.util.List.of(new RecipeInstruction(1, "Mix ingredients")),
            null
        );
        assertTrue(good.isValid());
    }

    @Test
    void result_extraction_is_unusable_when_status_set() {
        RecipeExtraction extraction = new RecipeExtraction(
            "v1", "unusable", "", "Not a recipe page", "", "", "", "", "", "", "",
            java.util.List.of(), java.util.List.of(), "No recipe found"
        );
        assertTrue(extraction.isUnusable());
    }
}
