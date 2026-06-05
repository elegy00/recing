# Research: Async Processing Patterns for Spring Boot + MongoDB

## Summary
Spring's `@Async` with `CompletableFuture` provides a straightforward way to submit background jobs and return immediately. For MongoDB, a single collection design with a status field (`PENDING` → `PROCESSING` → `COMPLETED`/`FAILED`) and appropriate compound indexes is sufficient for an MVP. Clients can poll efficiently using ETag headers and exponential backoff on the client side (not server-side caching). Spring Data MongoDB's optimistic locking via `@Version` prevents concurrent updates, while a well-configured `TaskExecutor` bean controls thread pool sizing.

## Findings

### 1. Spring @Async with CompletableFuture — Submit jobs asynchronously, return job ID immediately

The pattern is simple: the controller returns a `CompletableFuture<String>` (the job ID), and Spring's async infrastructure handles dispatching to a thread pool. The method itself runs asynchronously, so you can submit work and return right away.

```java
@Service
public class RecipeExtractionService {

    private final MongoTemplate mongoTemplate;
    private final TaskExecutor taskExecutor;

    public CompletableFuture<String> extractRecipe(String url) {
        // 1. Create submission document with PENDING status
        JobSubmission submission = new JobSubmission();
        submission.setId(UUID.randomUUID().toString());
        submission.setUrl(url);
        submission.setStatus(JobStatus.PENDING);
        submission.setCreatedAt(Instant.now());
        mongoTemplate.save(submission);

        // 2. Kick off background work, return immediately with job ID
        CompletableFuture.runAsync(() -> processSubmission(submission), taskExecutor)
            .exceptionally(ex -> {
                markFailed(submission.getId(), ex.getMessage());
                return null;
            });

        return CompletableFuture.completedFuture(submission.getId());
    }

    private void processSubmission(JobSubmission submission) {
        mongoTemplate.save(
            JobStatus.from(submission).setStatus(PROCESSING));  // update status

        try {
            String content = fetchAndExtract(submission.getUrl());
            mongoTemplate.save(
                JobStatus.from(submission).setResult(content).setStatus(COMPLETED));
        } catch (Exception e) {
            mongoTemplate.save(
                JobStatus.from(submission).setError(e.getMessage()).setStatus(FAILED));
        }
    }
}

@RestController
@RequestMapping("/recipes")
public class RecipeController {

    private final RecipeExtractionService service;

    @PostMapping
    public CompletableFuture<ResponseEntity<Map<String, String>>> submit(
            @RequestBody Map<String, String> body) {
        return service.extractRecipe(body.get("url"))
            .thenApply(jobId -> ResponseEntity.ok(Map.of("jobId", jobId)));
    }
}
```

**Key points:**
- `CompletableFuture.runAsync()` with an explicit `TaskExecutor` avoids the default `ForkJoinPool.commonPool()`, which is shared and can starve under load. [Spring Boot Docs](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-aspect.html)
- The controller method itself can return `CompletableFuture` — Spring MVC handles this natively (async dispatch), so the request thread is released immediately. [Spring MVC Async](https://docs.spring.io/spring-framework/reference/web/servlet/mvc.html#servlet-ann-controller-async)

### 2. MongoDB Document Design for Long-Running Workflows

**Recommendation: Single collection with embedded result field.** For an MVP, a single `jobs` collection is simpler and avoids cross-collection joins. The document grows from minimal (on submit) to full (on completion).

```
Collection: jobs

{
  "_id": "a1b2c3d4-...",          // String UUID — client-facing job ID
  "url": "https://example.com/recipe",
  "status": "COMPLETED",           // PENDING → PROCESSING → COMPLETED | FAILED
  "result": {                      // null until completed
    "title": "Chocolate Cake",
    "ingredients": [...],
    "instructions": [...]
  },
  "error": null,                   // populated on failure
  "version": 1,                    // @Version for optimistic locking
  "createdAt": ISODate("2026-06-04T..."),
  "updatedAt": ISODate("2026-06-04T...")
}

Indexes:
  - { _id: 1 }                    // default, used for GET /jobs/{id}
  - { status: 1 }                 // optional: for admin dashboards filtering by status
  - { createdAt: -1 }             // optional: for listing recent jobs
```

**Why single collection over separate collections?**
- Simpler CRUD — no need to coordinate inserts across two collections
- Atomic updates — `updateOne` with `$set` is idempotent and safe under concurrency
- The "result" field starts as null/empty, so there's minimal storage waste in the PENDING state
- For an MVP where you're not querying by result content, embedding avoids `$lookup` overhead

**When to split later:** If results grow very large (multi-KB JSON blobs from LLM extraction), consider a separate `job_results` collection or storing results as files with just a reference in the job document. But this is premature optimization for MVP. [MongoDB Schema Design](https://www.mongodb.com/docs/manual/core/data-model-design/)

**Status field design:**
```java
public enum JobStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED
}
```

### 3. Polling Pattern — Efficient GET /jobs/{id}

**ETag-based conditional requests** reduce bandwidth and server load by returning `304 Not Modified` when the job hasn't changed:

```java
@GetMapping("/jobs/{jobId}")
public ResponseEntity<JobDto> getJob(@PathVariable String jobId,
                                     @RequestHeader(value = "If-None-Match", required = false) String etag) {
    JobSubmission submission = mongoTemplate.findById(jobId, JobSubmission.class);
    if (submission == null) return ResponseEntity.notFound().build();

    // ETag based on content hash: MD5 of serialized status + result
    String newEtag = generateETag(submission.getStatus(), submission.getResult());

    if (etag != null && etag.equals(newEtag)) {
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
            .header("ETag", newEtag)
            .build();
    }

    JobDto dto = toDto(submission);
    return ResponseEntity.ok()
        .header("ETag", newEtag)
        .body(dto);
}

private String generateETag(JobStatus status, Object result) {
    // Simple content-based hash for the ETag
    String content = status.name() + (result != null ? result.toString() : "");
    try {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] digest = md.digest(content.getBytes(StandardCharsets.UTF_8));
        return "\"" + Base64.getEncoder().encodeToString(digest) + "\"";
    } catch (NoSuchAlgorithmException e) {
        throw new RuntimeException(e);
    }
}
```

**Client-side polling best practices:**
- Start with short intervals (1–2 seconds), increase exponentially up to a max (e.g., 30s)
- Stop polling when status is `COMPLETED` or `FAILED` — no need for timeout-based cancellation on the client
- Consider [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) as a more efficient alternative to polling, but polling is fine for MVP

```javascript
// Example: exponential backoff polling in JavaScript
async function pollJob(jobId, maxAttempts = 60, baseDelayMs = 1000) {
    let delay = baseDelayMs;
    for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(`/jobs/${jobId}`);

        if (res.status === 304) {
            // Unchanged — wait and retry
            await sleep(delay);
            delay = Math.min(delay * 2, 30_000);
            continue;
        }

        const job = await res.json();
        if (job.status === 'COMPLETED') return job.result;
        if (job.status === 'FAILED') throw new Error(job.error);

        // Wait before next poll with backoff
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000);
    }
    throw new Error('Job timed out');
}
```

**No server-side rate limiting needed for MVP.** MongoDB reads are fast. If the app scales beyond a few hundred concurrent polls, add simple per-client rate limiting (e.g., Redis-based sliding window) or switch to SSE/websockets.

### 4. Spring Data MongoDB Best Practices

**@Document and @Indexed annotations:**
```java
import org.springframework.data.annotation.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.domain.Persistable;

@Document(collection = "jobs")
public class JobSubmission implements Persistable<String> {

    @Id                       // Maps to _id in MongoDB
    private String id;         // UUID — client-visible job ID

    @Indexed(unique = false)  // Optional: if you want to query by URL
    private String url;

    private JobStatus status;

    @Version                  // Optimistic locking version field
    private Long version;

    private Instant createdAt;
    private Instant updatedAt;

    // Embedded result — null until completed
    private RecipeResult result;

    private String error;

    // Persistable interface: tells Spring Data this is a new document by ID presence
    @Override
    public boolean isNew() {
        return id == null || mongoTemplate.findById(id, getClass()) == null;
    }
}
```

**Optimistic locking with @Version:**
- Spring Data automatically increments `version` on each save via `updateOne` with `{ _id: ..., version: <current> }`
- If another process modified the document first, a `OptimisticLockingFailureException` is thrown
- For this use case, optimistic locking guards against concurrent updates to the same job (e.g., if you had multiple workers processing the same submission)
- In practice, with unique job IDs and single-worker-per-job semantics, conflicts are rare — but it's a good safety net

**Key annotations reference:**
| Annotation | Purpose |
|---|---|
| `@Document(collection = "...")` | Maps class to MongoDB collection |
| `@Id` | Maps to `_id`; auto-generates ObjectId by default, but String works fine for UUIDs |
| `@Indexed` | Creates a compound or single-field index on save (use `@CompoundIndex` for multi-field) |
| `@Version` | Optimistic locking; Spring Data adds `{ version: <current> }` to update criteria |
| `@Field("name")` | Maps Java field to different MongoDB field name |

**Important:** Don't use `@Indexed(unique = true)` on the job ID unless you have a specific reason — it's unnecessary overhead since `_id` is already unique by design.

### 5. Thread Pool Configuration for Spring @Async

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.Executor;

@Configuration
@EnableAsync   // Required to enable @Async processing
public class AsyncConfig {

    @Bean("taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);            // Idle threads kept alive
        executor.setMaxPoolSize(20);            // Max concurrent jobs
        executor.setQueueCapacity(100);         // Jobs queued when all threads busy
        executor.setThreadNamePrefix("recipe-extractor-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
```

**Sizing guidelines for an MVP:**
| Parameter | Recommendation | Rationale |
|---|---|---|
| `corePoolSize` | 3–10 | Matches CPU cores × 2 for I/O-bound work (fetching URLs, calling LLM APIs) |
| `maxPoolSize` | core × 2 to × 4 | Allows burst handling during traffic spikes |
| `queueCapacity` | 50–200 | Prevents task rejection under moderate overload; too high risks OOM |
| Rejection policy | `CallerRunsPolicy` | Degraded but safe — the calling thread processes the task, naturally throttling submissions |

**Important notes:**
- **Never use default Spring async (no bean specified)** — it falls back to a single-thread executor or the common ForkJoinPool, both of which are wrong for production. Always define an explicit `TaskExecutor` bean. [Spring Boot Async Docs](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-aspect.html#boot-features-task-execution-and-scheduling)
- For I/O-bound work (HTTP calls to external APIs, LLM extraction), thread count can be higher than CPU cores since threads spend most time waiting. A rough formula: `corePoolSize = CPU_cores × (1 + wait_time/compute_time)`
- Monitor pool metrics via Spring Boot Actuator (`/actuator/metrics/thread.executors`) — look at active thread count and queue size to tune

## Sources

- **Kept:** [Spring Framework Reference — MVC Async Support](https://docs.spring.io/spring-framework/reference/web/servlet/mvc.html#servlet-ann-controller-async) — Official docs on returning `CompletableFuture` from controllers
- **Kept:** [Spring Boot Task Execution & Scheduling](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-aspect.html#boot-features-task-execution-and-scheduling) — Configuration of `TaskExecutor`, `@EnableAsync`, thread pool tuning
- **Kept:** [MongoDB Schema Design Principles](https://www.mongodb.com/docs/manual/core/data-model-design/) — Embedding vs referencing, single collection patterns
- **Kept:** [Spring Data MongoDB Reference](https://docs.spring.io/spring-data/mongodb/reference/) — `@Document`, `@Indexed`, `@Version`, optimistic locking behavior
- **Kept:** [MDN Web Docs — Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) — Alternative to polling for real-time updates

## Gaps

1. **Rate limiting strategy** — Not covered in detail. For MVP, no rate limiting is fine, but a production plan should include per-client throttling (Redis sliding window or Spring `@ControllerAdvice` with rate limit headers).
2. **Job cancellation / timeout** — The research didn't cover how to cancel long-running extractions mid-flight. This requires tracking the worker thread and calling `.cancel()` on it, plus MongoDB update to set status = `CANCELLED`.
3. **SSE implementation details** — While mentioned as an alternative to polling, a concrete Spring SSE implementation (using `Flux<JobStatus>` or `SseEmitter`) was not fully detailed. Worth researching if polling proves insufficient at scale.
4. **Database connection pool sizing** — Not covered separately from thread pool config. HikariCP settings for MongoDB should be sized relative to the async thread pool (don't create more DB connections than active worker threads).

## Supervisor coordination

No supervisor contact needed — research is complete and covers all 5 requested topics with code examples and practical recommendations tailored to the MVP use case.
