package dev.recing.web;

import dev.recing.web.fetch.RecipeFetchException;
import dev.recing.web.fetch.RecipeFetchResult;
import dev.recing.web.fetch.RecipeFetchService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class RecipeController {

    private final RecipeFetchService fetchService = new RecipeFetchService();

    @GetMapping("/")
    public String index() {
        return "index";
    }

    @PostMapping("/recipes")
    public String submitRecipe(@RequestParam String url, Model model) {
        model.addAttribute("submittedUrl", url.trim());

        try {
            RecipeFetchResult result = fetchService.fetch(url);
            // Success — pass metadata to the template for display
            model.addAttribute("fetchStatus", "success");
            model.addAttribute("finalUrl", result.finalUrl());
            model.addAttribute("httpStatus", result.status());
            model.addAttribute("contentType", result.contentType());
            model.addAttribute("byteCount", result.byteCount());
        } catch (RecipeFetchException e) {
            // Failure — pass error message to the template
            model.addAttribute("error", e.getMessage());
        }

        return "index";
    }
}
