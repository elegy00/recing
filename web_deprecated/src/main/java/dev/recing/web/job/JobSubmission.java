package dev.recing.web.job;

import dev.recing.web.llm.RecipeExtraction;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** MongoDB document representing a recipe extraction job. */
@Document(collection = "jobs")
public class JobSubmission {

    @Id private String id;
    private String url;
    private JobStatus status;
    private Instant createdAt, updatedAt;
    private RecipeExtraction result;
    private String error;

    public JobSubmission() {}

    // --- Getters / setters ---
    public String getId()       { return id; }
    public void setId(String id){ this.id = id; }

    public String getUrl()           { return url; }
    public void setUrl(String url)   { this.url = url; }

    public JobStatus getStatus()     { return status; }
    public void setStatus(JobStatus s) { this.status = s; }

    public Instant getCreatedAt()  { return createdAt; }
    public void setCreatedAt(Instant i) { this.createdAt = i; }

    public Instant getUpdatedAt()  { return updatedAt; }
    public void setUpdatedAt(Instant i) { this.updatedAt = i; }

    public RecipeExtraction getResult()     { return result; }
    public void setResult(RecipeExtraction r) { this.result = r; }

    public String getError()       { return error; }
    public void setError(String e){ this.error = e; }
}
