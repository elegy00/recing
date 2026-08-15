import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    // Both test files share one Postgres database; parallel execution would let
    // auth.test.ts inserts break recipe.test.ts row-count assertions.
    fileParallelism: false,
  },
});
