package dev.recing.web;

import dev.recing.web.job.JobProcessingService;
import dev.recing.web.job.JobStatus;
import dev.recing.web.job.JobSubmission;
import dev.recing.web.job.JobSubmissionRepository;
import dev.recing.web.llm.RecingLlmProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.Map;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.time.Instant;
import java.util.UUID;

@Controller
@EnableConfigurationProperties(RecingLlmProperties.class)
public class RecipeController {

    private static final Logger log = LoggerFactory.getLogger(RecipeController.class);

    private final JobSubmissionRepository jobRepo;
    private final JobProcessingService processingService;
    private final RecingLlmProperties llmProps;

    public RecipeController(JobSubmissionRepository jobRepo,
                            JobProcessingService processingService,
                            RecingLlmProperties llmProps) {
        this.jobRepo = jobRepo;
        this.processingService = processingService;
        this.llmProps = llmProps;
    }

    // -----------------------------------------------------------------------
    // GET / — home (submit form)
    // -----------------------------------------------------------------------
    @GetMapping("/")
    public String index() {
        return "index";
    }

    // -----------------------------------------------------------------------
    // GET /recipes — list all completed recipes (HTML)
    // -----------------------------------------------------------------------
    @GetMapping(value = "/recipes", produces = MediaType.TEXT_HTML_VALUE)
    public String recipeList(Model model) {
        var allJobs = jobRepo.findAll();
        var validRecipes = allJobs.stream()
                .filter(j -> j.getStatus() == JobStatus.COMPLETED
                        && j.getResult() != null
                        && j.getResult().isValid())
                .toList();
        model.addAttribute("recipes", validRecipes);
        return "recipe-list";
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

        // Kick off async processing via separate service bean (@Async proxy works)
        processingService.process(job.getId());

        return "redirect:/recipes/" + job.getId();
    }

    // -----------------------------------------------------------------------
    // GET /recipes/{jobId} (JSON) — lightweight status poll for AJAX
    // -----------------------------------------------------------------------
    @GetMapping(value = "/recipes/{jobId}", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<?> getJobStatus(@PathVariable String jobId) {
        return jobRepo.findById(jobId)
                .<ResponseEntity<?>>map(job -> ResponseEntity.ok(
                        Map.of("status", job.getStatus().name())))
                .orElse(ResponseEntity.notFound().build());
    }

    // -----------------------------------------------------------------------
    // GET /recipes/{jobId} (HTML) — show loading state or final result
    // -----------------------------------------------------------------------
    @GetMapping(value = "/recipes/{jobId}", produces = MediaType.TEXT_HTML_VALUE)
    public String getJob(@PathVariable String jobId, Model model) {
        JobSubmission job = jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            return "redirect:/";
        }

        model.addAttribute("submittedUrl", job.getUrl());
        model.addAttribute("jobId", jobId);
        model.addAttribute("jobStatus", job.getStatus().name());

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
}
