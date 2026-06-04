# 3 Spring Boot app with dummy UI

Simple setup for a small Spring web application that lets you paste a recipe URL and submit it.

## Create the app

Use Spring Initializr from the project root:

```bash
curl https://start.spring.io/starter.zip \
  -d type=maven-project \
  -d language=java \
  -d bootVersion=3.5.0 \
  -d groupId=dev.recing \
  -d artifactId=web \
  -d name=web \
  -d packageName=dev.recing.web \
  -d dependencies=web,thymeleaf,devtools \
  -o web.zip
unzip web.zip -d web
rm web.zip
```

## Add a simple page

Create `web/src/main/resources/templates/index.html`:

```html
<!doctype html>
<html>
  <body>
    <h1>Recing</h1>
    <form method="post" action="/recipes">
      <label for="url">Recipe URL</label>
      <input id="url" name="url" type="url" required />
      <button type="submit">Submit</button>
    </form>

    <p th:if="${submittedUrl}">
      Submitted: <span th:text="${submittedUrl}"></span>
    </p>
  </body>
</html>
```

## Add a controller

Create `web/src/main/java/dev/recing/web/RecipeController.java`:

```java
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
```

## Run it

```bash
cd web
./mvnw spring-boot:run
```

Open `http://localhost:8080` and submit a recipe URL. Later, replace the dummy submit handler with scraping and LLM processing.
