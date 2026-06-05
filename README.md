# Recing

Recipe URL extractor powered by a local LLM (llama.cpp).

## Quick Start

### 1. Start MongoDB with Docker Compose

```bash
docker compose up -d
```

This starts a MongoDB 7.0 container on `localhost:27017` with persistent volume storage (`mongodb-data`). The database name is `recing`.

To stop and clean up:

```bash
# Stop the container (keeps data)
docker compose down

# Remove container and volume (deletes all stored jobs)
docker compose down -v
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
├── docs/requirements/advanced/         # Async processing & refinement specs
└── docker-compose.yml                  # MongoDB container for local dev
```

## Requirements

- Java 17+
- Maven 3.8+
- Docker + Docker Compose (for MongoDB)
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
