package dev.recing.web.job;

import org.springframework.data.mongodb.repository.MongoRepository;

/** MongoDB repository for recipe extraction jobs. */
public interface JobSubmissionRepository extends MongoRepository<JobSubmission, String> {
}
