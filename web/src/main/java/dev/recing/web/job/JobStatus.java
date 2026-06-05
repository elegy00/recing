package dev.recing.web.job;

/** Lifecycle states for a recipe extraction job. */
public enum JobStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED
}
