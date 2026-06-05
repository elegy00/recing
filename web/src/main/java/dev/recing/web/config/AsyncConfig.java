package dev.recing.web.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/** Async thread pool — single-threaded to avoid overwhelming the local LLM. */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean("recipeTaskExecutor")
    public Executor recipeTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("recipe-extractor-");
        executor.initialize();
        return executor;
    }
}
