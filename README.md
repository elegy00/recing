# Recing

Recipe URL extractor powered by a local LLM (llama.cpp).

## Quick Start

### 1. Start MongoDB with Podman

```bash
podman run -d \
  --name recing-mongodb \
  -p 27017:27017 \
  -v mongodb-data:/var/lib/mongodb/data \
  -e MONGO_INITDB_DATABASE=recing \
  mongo:7.0
```

This starts a MongoDB 7.0 container on `localhost:27017` with persistent volume storage (`mongodb-data`). The database name is `recing`.

To stop and clean up:

```bash
# Stop the container (keeps data)
podman stop recing-mongodb && podman rm recing-mongodb

# Remove volume (deletes all stored jobs)
podman volume rm mongodb-data
```

### 2. Start llama.cpp

Run your local llama.cpp server exposing an OpenAI-compatible endpoint:

```bash
# Example with llama-server from llama.cpp build
./llama-server --model <path-to-model.gguf> --port 8085
```

The default endpoint is `http://localhost:8085/v1/chat/completions`. Override in `web/src/main/resources/application.properties`:

```properties
recing.llm.endpoint=http://localhost:8085/v1/chat/completions
recing.llm.model=qwen3.6
```

### 3. Run the application

```bash
cd web && ./mvnw spring-boot:run
# or from project root
./mvnw -pl web spring-boot:run
```

Open [http://localhost:8080](http://localhost:8080) and submit a recipe URL.

## Project Structure

```
recing/
├── web/                          # Spring Boot application (Java 17, Maven)
│   ├── src/main/java/dev/recing/web/
│   │   ├── RecipeController.java       # POST /recipes → async job
│   │   ├── fetch/                      # MVP1: URL fetching
│   │   └── llm/                        # MVP2: LLM extraction pipeline
│   └── src/main/resources/
│       ├── application.properties
│       └── templates/                  # Thymeleaf views (index, result)
└── docs/requirements/advanced/         # Async processing & refinement specs
```

## Requirements

- Java 17+
- Maven 3.8+
- Podman (for MongoDB)
- llama.cpp server running locally

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Submit a recipe URL form |
| POST | `/recipes?url=...` | Submit URL, redirects to job page |
| GET | `/recipes/{jobId}` | Show loading state or final result |

## Async Processing Flow

```mermaid
flowchart LR
  A[POST /recipes] --> B[302 Redirect\n/recipes/{jobId}]
  B --> C[MongoDB: PENDING job]\nD[Async worker: one-at-a-time]\nE[Fetch + LLM extraction]\nF[MongoDB update:\nCOMPLETED or FAILED]\nG[GET /recipes/{jobId}]\nH[Thymeleaf: loading or result]
  C --> D
  D --> E
  E --> F
  G --> H
```

Jobs are processed one at a time to avoid overwhelming the local LLM. While processing, the job page shows a spinner — refresh manually to see updates.
