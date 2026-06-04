package dev.recing.web;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class RecipeController {
    @GetMapping("/")
    public String index() {
        return "index";
    }

    @PostMapping("/recipes")
    public String submitRecipe(@RequestParam String url, Model model) {
        model.addAttribute("submittedUrl", url);
        return "index";
    }
}