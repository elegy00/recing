# Store Submissions for Async Processing — Solution Design

## Goal

Decouple URL submission, LLM processing, and result display. Client submits → gets redirected to a job page; background worker processes one-at-a-time (avoids overwhelming local LLM); job page shows loading or final result. MongoDB persists state.

## Architecture

```mermaid
flowchart LR
  A[Client POST /recipes] --> B[Controller redirect\n/recipes/{jobId}]
  B --> C[MongoDB: jobs collection]
  C --> D[@Async single-thread\nworker pool]
  D --> E[Fetch + LLM extraction]
  E --> F[MongoDB update:\nCOMPLETED or FAILED]
  G[Client GET /recipes/{jobId}] --> H[Thymeleaf: loading or result]
```

**Two endpoints replace the synchronous `POST /recipes`:**

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/recipes` | POST | Submit URL, get redirected to job page | 302 → `/recipes/{jobId}` |
| `/recipes/{jobId}` | GET | Show loading state or final result | HTML page (Thymeleaf) |

**State machine:** `PENDING` → `PROCESSING` → `COMPLETED` | `FAILED`

## MongoDB Design

### Collection: `jobs` (single collection)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | String UUID | Client-facing job ID |
| `url` | String | Submitted URL |
| `status` | Enum | PENDING → PROCESSING → COMPLETED / FAILED |
| `result` | RecipeExtraction | null until completed |
| `error` | String | Error message on failure |
| `version` | Long | @Version for optimistic locking |
| `createdAt/updatedAt` | Instant | Timestamps |

**Indexes:** `_id` (default), `{ status: 1 }`, `{ createdAt: -1 }`. Single collection avoids `$lookup`; atomic `$set` updates are safe under concurrency. Split to separate `job_results` only if LLM output > 50 KB.

### Java model

```java
@Document(collection = "jobs")
public class JobSubmission implements Persistable<String> {
    @Id String id; String url; JobStatus status;
    Long version; Instant createdAt, updatedAt;
    RecipeExtraction result; String error;
}
enum JobStatus { PENDING, PROCESSING, COMPLETED, FAILED }
```

## Async Processing Model

### Thread pool — single thread only (one-at-a-time)

Only one job processes concurrently to avoid overwhelming the local LLM.

```java
@Configuration @EnableAsync
public class AsyncConfig {
    @Bean("recipeTaskExecutor") public Executor taskExecutor() {
        ThreadPoolTaskExecutor e = new ThreadPoolTaskExecutor();
        e.setCorePoolSize(1); e.setMaxPoolSize(1);
        e.setQueueCapacity(50); e.setThreadNamePrefix("recipe-extractor-");
        return e;
    }
}
```

### Worker

```java
@Async("recipeTaskExecutor")
public void processSubmission(String jobId) {
    JobSubmission job = mongo.findById(jobId, JobSubmission.class);
    job.setStatus(JobStatus.PROCESSING); job.setUpdatedAt(Instant.now());
    mongo.save(job);
    try { /* fetch → extract → setResult() + COMPLETED */ }
    catch (Exception e) { job.setError(e.getMessage()); job.setStatus(JobStatus.FAILED); }
    finally { job.setUpdatedAt(Instant.now()); mongo.save(job); }
}
```

## Controller Endpoints

### POST /recipes — Submit & redirect

Creates a PENDING job and redirects the browser to the job page.

```java
@PostMapping("/recipes")
public String submit(@RequestParam String url, RedirectAttributes attrs) {
    JobSubmission job = new JobSubmission();
    job.setId(UUID.randomUUID().toString()); job.setUrl(url.trim());
    job.setStatus(JobStatus.PENDING); job.setCreatedAt(Instant.now());
    mongo.save(job);
    extractionService.processSubmission(job.getId());  // async
    return "redirect:/recipes/" + job.getId();
}
```

### GET /recipes/{jobId} — Show loading or result

Renders Thymeleaf templates based on job status.

```java
@GetMapping("/recipes/{jobId}")
public String getJob(@PathVariable String jobId, Model model) {
    JobSubmission job = mongo.findById(jobId, JobSubmission.class);
    if (job == null) return "error::404";
    model.addAttribute("submittedUrl", job.getUrl());
    if (job.getResult() != null) { model.addAttribute("extraction", job.getResult()); return "result"; }
    if ("FAILED".equals(job.getStatus())) { model.addAttribute("error", job.getError()); return "index"; }
    return "job-loading";
}
```

## Templates

### `job-loading.html` — Loading state

Shown while PENDING/PROCESSING. User refreshes manually to see updates.

```html
<!DOCTYPE html>
<html lang="en">
<head><title>Recing — Processing</title></head>
<body style="font-family:system-ui;max-width:640px;margin:2rem auto;padding:0 1rem;text-align:center;">
    <h1>Processing Recipe</h1>
    <p>Pulling content from <a th:href="${submittedUrl}" th:text="${submittedUrl}"></a></p>
    <div style="margin:2rem;font-size:2rem">⏳</div>
    <p>This may take a minute. Refresh to check progress.</p>
    <p><a href="/">&larr; Submit another URL</a></p>
</body>
</html>
```

### `result.html` — Reuse existing template

COMPLETED case reuses the existing MVP3 `result.html`. Expects `extraction` on model, sourced from MongoDB.

## Configuration

Add to `application.properties`:

```properties
recing.mongodb.uri=mongodb://localhost:27017/recing
```

Spring Boot auto-configures MongoDB via `spring-boot-starter-data-mongodb`. No thread pool properties needed — hardcoded 1 core / 1 max in the config class.

## Testing plan

- `JobSubmissionTest`: model fields, `isNew()` implementation, enum transitions.
- `RecipeExtractionServiceTest.processSubmission()`: mock success → asserts COMPLETED with result.
- `RecipeExtractionServiceTest.processSubmission_failure()`: mock exception → asserts FAILED with error message.
- `RecipeControllerTest.submit_redirects()`: POST returns 302 to `/recipes/{jobId}`; MongoDB document exists with PENDING status.
- `RecipeControllerTest.jobPage_completed()`: GET job page after completion renders `result` template with extraction data.
- `RecipeControllerTest.jobPage_loading()`: GET job page while processing renders `job-loading` template.
- `RecipeControllerTest.jobPage_failed()`: GET job page on failure shows error, returns to index view.
- Manual test: run MongoDB locally via `docker compose up -d`, submit URL in browser, verify redirect → loading → result flow.

## Dependencies to add (pom.xml)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-mongodb</artifactId>
</dependency>
```

## What is intentionally NOT done

- No job listing/browsing API — not needed for core flow; add later for admin dashboard.
- No retry logic on transient failures — failed extraction returns `FAILED` with error message; user resubmits manually from the index page.
- No TTL indexes or automatic cleanup of old jobs. Add scheduled purge later if storage grows.
- No SSE/WebSocket/long-polling — simple page refresh is sufficient for MVP.
