package dev.recing.web.job;

import dev.recing.web.fetch.RecipeFetchResult;
import dev.recing.web.fetch.RecipeFetchService;
import dev.recing.web.llm.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;

/** Processes recipe extraction jobs asynchronously. */
@Service
public class JobProcessingService {

    private static final Logger log = LoggerFactory.getLogger(JobProcessingService.class);

    private final RecipeFetchService fetchService = new RecipeFetchService();
    private final JobSubmissionRepository jobRepo;
    private final RecipeExtractionService extractionService;

    public JobProcessingService(JobSubmissionRepository jobRepo,
                                RecipeExtractionService extractionService) {
        this.jobRepo = jobRepo;
        this.extractionService = extractionService;
    }

    /** Runs on recipeTaskExecutor (single-threaded). */
    @Async("recipeTaskExecutor")
    public void process(String jobId) {
        JobSubmission job = jobRepo.findById(jobId).orElse(null);
        if (job == null) return;

        job.setStatus(JobStatus.PROCESSING);
        job.setUpdatedAt(Instant.now());
        jobRepo.save(job);

        try {
            // Step 1: Fetch content from the URL
            RecipeFetchResult fetchResult = fetchService.fetch(job.getUrl());

            // Step 2: Extract recipe via LLM
            String title = RecipeContentReducer.extractTitle(fetchResult.body());
            LlmExtractionResult result = extractionService.extract(
                fetchResult.finalUrl(),
                fetchResult.contentType(),
                title,
                fetchResult.body()
            );

            job.setResult(result.extraction());
            job.setStatus(JobStatus.COMPLETED);
        } catch (Exception e) {
            log.error("Job {} failed: {}", jobId, e.getMessage());
            job.setError(e.getMessage());
            job.setStatus(JobStatus.FAILED);
        } finally {
            job.setUpdatedAt(Instant.now());
            jobRepo.save(job);
        }
    }
}
