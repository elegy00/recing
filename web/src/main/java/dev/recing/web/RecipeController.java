package dev.recing.web;

import dev.recing.web.fetch.RecipeFetchException;
import dev.recing.web.fetch.RecipeFetchResult;
import dev.recing.web.fetch.RecipeFetchService;
import dev.recing.web.llm.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@EnableConfigurationProperties(RecingLlmProperties.class)
public class RecipeController {

    private static final Logger log = LoggerFactory.getLogger(RecipeController.class);

    private final RecipeFetchService fetchService = new RecipeFetchService();
    private final RecingLlmProperties llmProps;

    public RecipeController(RecingLlmProperties llmProps) {
        this.llmProps = llmProps;
    }

    @GetMapping("/")
    public String index() {
        return "index";
    }

    @PostMapping("/recipes")
    public String submitRecipe(@RequestParam String url, Model model) {
        model.addAttribute("submittedUrl", url.trim());

        try {
            // Step 1: Fetch (MVP1)
            RecipeFetchResult fetchResult = fetchService.fetch(url);
            model.addAttribute("fetchStatus", "success");
            model.addAttribute("finalUrl", fetchResult.finalUrl());
            model.addAttribute("httpStatus", fetchResult.status());
            model.addAttribute("contentType", fetchResult.contentType());
            model.addAttribute("byteCount", fetchResult.byteCount());

            // Step 2: Extract via LLM (MVP2)
            try {
                String title = RecipeContentReducer.extractTitle(fetchResult.body());
                RecipeExtractionService extractionService = new RecipeExtractionService(llmProps);
                LlmExtractionResult result = extractionService.extract(
                    fetchResult.finalUrl(),
                    fetchResult.contentType(),
                    title,
                    fetchResult.body()
                );

                // Success — pass extraction to result template
                model.addAttribute("extraction", result.extraction());
                model.addAttribute("llmMetadata", result.metadata());
                return "result";

            } catch (LlmExtractionException e) {
                // LLM error — show on index with fetch metadata still visible
                log.warn("LLM extraction failed: code={}, detail={}", e.getCode(), e.getMessage());
                model.addAttribute("llmError", e.getMessage());
            }

        } catch (RecipeFetchException e) {
            // Fetch error — show on index
            log.warn("Fetch failed: code={}, detail={}", e.getCode(), e.getMessage());
            model.addAttribute("error", e.getMessage());
        }

        return "index";
    }
}
