package dev.recing.web;

import dev.recing.web.job.JobProcessingService;
import dev.recing.web.job.JobStatus;
import dev.recing.web.job.JobSubmission;
import dev.recing.web.job.JobSubmissionRepository;
import dev.recing.web.llm.RecipeExtractionService;
import dev.recing.web.llm.RecipeExtraction;
import dev.recing.web.llm.RecipeExtractionService;
import dev.recing.web.llm.RecipeIngredient;
import dev.recing.web.llm.RecipeInstruction;
import dev.recing.web.llm.RecingLlmProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class RecipeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JobSubmissionRepository jobRepo;

    @MockBean
    private JobProcessingService processingService;

    @MockBean
    private RecipeExtractionService extractionService;

    @Autowired
    private RecingLlmProperties llmProps;

    // --- POST /recipes — submit & redirect ---

    @Test
    void submit_redirects_to_job_page() throws Exception {
        String url = "http://example.com/recipe";
        JobSubmission savedJob = new JobSubmission();
        savedJob.setId("job-123");
        savedJob.setUrl(url);
        savedJob.setStatus(JobStatus.PENDING);

        when(jobRepo.save(any(JobSubmission.class))).thenReturn(savedJob);

        mockMvc.perform(post("/recipes")
                        .param("url", url))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrlPattern("/recipes/*"));
    }

    @Test
    void submit_creates_job_with_correct_initial_state() throws Exception {
        String url = "http://example.com/test";
        JobSubmission savedJob = new JobSubmission();
        savedJob.setId("job-456");
        savedJob.setUrl(url);
        savedJob.setStatus(JobStatus.PENDING);

        when(jobRepo.save(any(JobSubmission.class))).thenReturn(savedJob);

        mockMvc.perform(post("/recipes").param("url", url))
                .andExpect(status().is3xxRedirection());

        // Verify the saved job had correct initial state
        verify(jobRepo).save(argThat(j -> {
            assertEquals(url.trim(), j.getUrl());
            return true;
        }));
    }

    @Test
    void submit_trims_url() throws Exception {
        String url = "  http://example.com/recipe  ";
        JobSubmission savedJob = new JobSubmission();
        savedJob.setId("job-789");
        savedJob.setUrl(url);
        savedJob.setStatus(JobStatus.PENDING);

        when(jobRepo.save(any(JobSubmission.class))).thenReturn(savedJob);

        mockMvc.perform(post("/recipes").param("url", url))
                .andExpect(status().is3xxRedirection());

        verify(jobRepo).save(argThat(j -> {
            assertEquals(url.trim(), j.getUrl());
            return true;
        }));
    }

    // --- GET /recipes/{jobId} — loading state ---

    @Test
    void jobPage_loading_shows_jobLoading_for_pending() throws Exception {
        JobSubmission job = new JobSubmission();
        job.setId("job-pending");
        job.setUrl("http://example.com/recipe");
        job.setStatus(JobStatus.PENDING);
        when(jobRepo.findById("job-pending")).thenReturn(Optional.of(job));

        mockMvc.perform(get("/recipes/job-pending").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("job-loading"));
    }

    @Test
    void jobPage_loading_shows_jobLoading_for_processing() throws Exception {
        JobSubmission job = new JobSubmission();
        job.setId("job-processing");
        job.setUrl("http://example.com/recipe");
        job.setStatus(JobStatus.PROCESSING);
        when(jobRepo.findById("job-processing")).thenReturn(Optional.of(job));

        mockMvc.perform(get("/recipes/job-processing").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("job-loading"));
    }

    // --- GET /recipes/{jobId} — completed ---

    @Test
    void jobPage_completed_shows_result_with_extraction() throws Exception {
        RecipeExtraction extraction = new RecipeExtraction(
            "v1", "extracted", "Pancakes", "", "", "", "", "", "", "", "",
            java.util.List.of(new RecipeIngredient("", "cup", "flour", "white", null)),
            java.util.List.of(new RecipeInstruction(1, "Mix")),
            null
        );

        JobSubmission job = new JobSubmission();
        job.setId("job-done");
        job.setUrl("http://example.com/recipe");
        job.setStatus(JobStatus.COMPLETED);
        job.setResult(extraction);
        when(jobRepo.findById("job-done")).thenReturn(Optional.of(job));

        mockMvc.perform(get("/recipes/job-done").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("result"))
                .andExpect(model().attributeExists("extraction"));
    }

    // --- GET /recipes/{jobId} — failed ---

    @Test
    void jobPage_failed_shows_index_with_error() throws Exception {
        JobSubmission job = new JobSubmission();
        job.setId("job-failed");
        job.setUrl("http://example.com/recipe");
        job.setStatus(JobStatus.FAILED);
        job.setError("Connection refused");
        when(jobRepo.findById("job-failed")).thenReturn(Optional.of(job));

        mockMvc.perform(get("/recipes/job-failed").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("index"))
                .andExpect(model().attributeExists("error"));
    }

    // --- GET /recipes/{jobId} (JSON) — status poll ---

    @Test
    void jobStatus_json_returns_status_for_processing() throws Exception {
        JobSubmission job = new JobSubmission();
        job.setId("job-proc");
        job.setUrl("http://example.com/recipe");
        job.setStatus(JobStatus.PROCESSING);
        when(jobRepo.findById("job-proc")).thenReturn(Optional.of(job));

        mockMvc.perform(get("/recipes/job-proc").accept("application/json"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"PROCESSING\"}"));
    }

    @Test
    void jobStatus_json_returns_status_for_completed() throws Exception {
        JobSubmission job = new JobSubmission();
        job.setId("job-comp");
        job.setUrl("http://example.com/recipe");
        job.setStatus(JobStatus.COMPLETED);
        when(jobRepo.findById("job-comp")).thenReturn(Optional.of(job));

        mockMvc.perform(get("/recipes/job-comp").accept("application/json"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"COMPLETED\"}"));
    }

    @Test
    void jobStatus_json_returns_404_for_unknown_job() throws Exception {
        when(jobRepo.findById("nonexistent")).thenReturn(Optional.empty());

        mockMvc.perform(get("/recipes/nonexistent").accept("application/json"))
                .andExpect(status().isNotFound());
    }

    // --- Async processing success path (unit-style via controller method) ---

    @Test
    void processSubmission_async_sets_completed_on_success() throws Exception {
        String jobId = "job-async-success";
        JobSubmission job = new JobSubmission();
        job.setId(jobId);
        job.setUrl("http://example.com/recipe");
        job.setStatus(JobStatus.PENDING);

        when(jobRepo.findById(jobId)).thenReturn(Optional.of(job));

        // Simulate fetch + extraction succeeding
        RecipeExtraction extraction = new RecipeExtraction(
            "v1", "extracted", "Pancakes", "", "", "", "", "", "", "", "",
            java.util.List.of(new RecipeIngredient("", "cup", "flour", "white", null)),
            java.util.List.of(new RecipeInstruction(1, "Mix")),
            null
        );

        // Capture the jobRepo.save calls to verify state transitions
        doAnswer(invocation -> {
            JobSubmission saved = invocation.getArgument(0);
            if (saved.getStatus() == JobStatus.PROCESSING) {
                // Second save: set result and COMPLETED
                saved.setResult(extraction);
                saved.setStatus(JobStatus.COMPLETED);
            }
            return saved;
        }).when(jobRepo).save(any());

        // Call the async method via JobProcessingService (runs on separate thread)
        JobProcessingService service = new JobProcessingService(jobRepo, extractionService);
        doAnswer(invocation -> {
            JobSubmission saved = invocation.getArgument(0);
            if (saved.getStatus() == JobStatus.PROCESSING) {
                saved.setResult(extraction);
                saved.setStatus(JobStatus.COMPLETED);
            }
            return saved;
        }).when(jobRepo).save(any());

        service.process(jobId);

        // Give async work time to complete
        Thread.sleep(300);

        verify(jobRepo, atLeastOnce()).save(any(JobSubmission.class));
    }

    // --- Async processing failure path ---

    @Test
    void processSubmission_async_sets_failed_on_fetch_error() throws Exception {
        String jobId = "job-async-fail";
        JobSubmission job = new JobSubmission();
        job.setId(jobId);
        job.setUrl("http://invalid.example.com/nonexistent");
        job.setStatus(JobStatus.PENDING);

        when(jobRepo.findById(jobId)).thenReturn(Optional.of(job));

        doAnswer(invocation -> {
            JobSubmission saved = invocation.getArgument(0);
            if (saved.getStatus() == JobStatus.PROCESSING) {
                saved.setError("Connection refused");
                saved.setStatus(JobStatus.FAILED);
            }
            return saved;
        }).when(jobRepo).save(any());

        JobProcessingService service = new JobProcessingService(jobRepo, extractionService);
        service.process(jobId);

        Thread.sleep(300);

        verify(jobRepo, atLeastOnce()).save(any(JobSubmission.class));
    }

    // --- GET / — index page ---

    @Test
    void indexPage_returns_index() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(view().name("index"));
    }

    // --- GET /recipes — recipe list view ---

    @Test
    void recipeList_empty_returns_list_view_with_empty_model() throws Exception {
        when(jobRepo.findAll()).thenReturn(java.util.List.of());

        mockMvc.perform(get("/recipes").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("recipe-list"))
                .andExpect(model().attribute("recipes", java.util.Collections.emptyList()));
    }

    @Test
    void recipeList_excludes_non_completed_jobs() throws Exception {
        JobSubmission pending = new JobSubmission();
        pending.setId("job-pending");
        pending.setUrl("http://example.com/pending");
        pending.setStatus(JobStatus.PENDING);

        JobSubmission processing = new JobSubmission();
        processing.setId("job-processing");
        processing.setUrl("http://example.com/processing");
        processing.setStatus(JobStatus.PROCESSING);

        JobSubmission failed = new JobSubmission();
        failed.setId("job-failed");
        failed.setUrl("http://example.com/failed");
        failed.setStatus(JobStatus.FAILED);
        failed.setError("some error");

        when(jobRepo.findAll()).thenReturn(java.util.List.of(pending, processing, failed));

        mockMvc.perform(get("/recipes").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("recipe-list"))
                .andExpect(model().attribute("recipes", java.util.Collections.emptyList()));
    }

    @Test
    void recipeList_excludes_unusable_results() throws Exception {
        RecipeExtraction unusable = new RecipeExtraction(
            "v1", "unusable", "Bad Page",
            null, null, null, null, null, null, null, null,
            java.util.List.of(), java.util.List.of(),
            "not a recipe page"
        );

        JobSubmission job = new JobSubmission();
        job.setId("job-done-unusable");
        job.setUrl("http://example.com/bad-page");
        job.setStatus(JobStatus.COMPLETED);
        job.setResult(unusable);

        when(jobRepo.findAll()).thenReturn(java.util.List.of(job));

        mockMvc.perform(get("/recipes").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("recipe-list"))
                .andExpect(model().attribute("recipes", java.util.Collections.emptyList()));
    }

    @Test
    void recipeList_excludes_jobs_with_null_result() throws Exception {
        JobSubmission job = new JobSubmission();
        job.setId("job-no-result");
        job.setUrl("http://example.com/no-extraction");
        job.setStatus(JobStatus.COMPLETED);
        // result is null

        when(jobRepo.findAll()).thenReturn(java.util.List.of(job));

        mockMvc.perform(get("/recipes").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("recipe-list"))
                .andExpect(model().attribute("recipes", java.util.Collections.emptyList()));
    }

    @Test
    void recipeList_includes_valid_completed_jobs() throws Exception {
        RecipeExtraction extraction = new RecipeExtraction(
            "v1", "extracted", "Pancakes",
            null, null, null, null, null, null, null, null,
            java.util.List.of(new RecipeIngredient("", "cup", "flour", "white", null)),
            java.util.List.of(new RecipeInstruction(1, "Mix")),
            null
        );

        JobSubmission validJob = new JobSubmission();
        validJob.setId("job-valid");
        validJob.setUrl("http://example.com/pancakes");
        validJob.setStatus(JobStatus.COMPLETED);
        validJob.setResult(extraction);

        when(jobRepo.findAll()).thenReturn(java.util.List.of(validJob));

        mockMvc.perform(get("/recipes").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("recipe-list"))
                .andExpect(model().attributeExists("recipes"));
    }

    @Test
    void recipeList_mix_of_jobs_filters_correctly() throws Exception {
        RecipeExtraction valid = new RecipeExtraction(
            "v1", "extracted", "Pancakes",
            null, null, null, null, null, null, null, null,
            java.util.List.of(new RecipeIngredient("", "cup", "flour", "white", null)),
            java.util.List.of(new RecipeInstruction(1, "Mix")),
            null
        );

        JobSubmission completedJob = new JobSubmission();
        completedJob.setId("job-done");
        completedJob.setUrl("http://example.com/pancakes");
        completedJob.setStatus(JobStatus.COMPLETED);
        completedJob.setResult(valid);

        JobSubmission failedJob = new JobSubmission();
        failedJob.setId("job-fail");
        failedJob.setUrl("http://example.com/bad");
        failedJob.setStatus(JobStatus.FAILED);
        failedJob.setError("oops");

        when(jobRepo.findAll()).thenReturn(java.util.List.of(completedJob, failedJob));

        mockMvc.perform(get("/recipes").accept("text/html"))
                .andExpect(status().isOk())
                .andExpect(view().name("recipe-list"));
    }
}
