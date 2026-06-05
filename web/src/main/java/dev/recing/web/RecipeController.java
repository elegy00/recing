package dev.recing.web;

import dev.recing.web.fetch.RecipeFetchResult;
import dev.recing.web.fetch.RecipeFetchService;
import dev.recing.web.job.JobStatus;
import dev.recing.web.job.JobSubmission;
import dev.recing.web.job.JobSubmissionRepository;
import dev.recing.web.llm.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.time.Instant;
import java.util.UUID;

@Controller
@EnableConfigurationProperties(RecingLlmProperties.class)
public class RecipeController {

    private static final Logger log = LoggerFactory.getLogger(RecipeController.class);

    private final RecipeFetchService fetchService = new RecipeFetchService();
    private final JobSubmissionRepository jobRepo;
    private final RecipeExtractionService extractionService;
    private final RecingLlmProperties llmProps;

    public RecipeController(JobSubmissionRepository jobRepo,
                            RecipeExtractionService extractionService,
                            RecingLlmProperties llmProps) {
        this.jobRepo = jobRepo;
        this.extractionService = extractionService;
        this.llmProps = llmProps;
    }

    @GetMapping("/")
    public String index() {
        return "index";
    }

    // -----------------------------------------------------------------------
    // POST /recipes — submit URL, create job, redirect to job page
    // -----------------------------------------------------------------------
    @PostMapping("/recipes")
    public String submit(@RequestParam String url, RedirectAttributes attrs) {
        JobSubmission job = new JobSubmission();
        job.setId(UUID.randomUUID().toString());
        job.setUrl(url.trim());
        job.setStatus(JobStatus.PENDING);
        Instant now = Instant.now();
        job.setCreatedAt(now);
        job.setUpdatedAt(now);

        jobRepo.save(job);

        // Kick off async processing (single-threaded)
        processSubmissionAsync(job.getId());

        return "redirect:/recipes/" + job.getId();
    }

    // -----------------------------------------------------------------------
    // GET /recipes/{jobId} — show loading state or final result
    // -----------------------------------------------------------------------
    @GetMapping("/recipes/{jobId}")
    public String getJob(@PathVariable String jobId, Model model) {
        JobSubmission job = jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            return "error::404";
        }

        model.addAttribute("submittedUrl", job.getUrl());

        if (job.getStatus() == JobStatus.COMPLETED) {
            model.addAttribute("extraction", job.getResult());
            return "result";
        }
        if (job.getStatus() == JobStatus.FAILED) {
            model.addAttribute("error", job.getError());
            return "index";
        }
        // PENDING or PROCESSING
        return "job-loading";
    }

    // -----------------------------------------------------------------------
    // Async worker — runs on recipeTaskExecutor (1 thread)
    // -----------------------------------------------------------------------
    @Async("recipeTaskExecutor")
    public void processSubmissionAsync(String jobId) {
        JobSubmission job = jobRepo.findById(jobId).orElse(null);
        if (job == null) return;

        job.setStatus(JobStatus.PROCESSING);
        job.setUpdatedAt(Instant.now());
        jobRepo.save(job);

        try {
            // Step 1: Fetch
            RecipeFetchResult fetchResult = fetchService.fetch(job.getUrl());

            // Step 2: Extract via LLM
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
