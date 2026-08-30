import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // .claude/worktrees/** excluded: a nested git worktree checkout under the
    // repo root has its own copy of every *.test.ts file — without this the
    // outer test run picks up BOTH copies and collides on conflicting
    // implementations of the same in-progress work.
    exclude: ["node_modules/**", ".next/**", ".claude/worktrees/**"],
    setupFiles: ["./test/setup.ts"],
    // The DB-integration suites all hit one local Postgres (max_connections 100).
    // Vitest defaults to one fork per CPU (8 here); each fork opens its own pg
    // Pool (default max 10), so full parallelism brushes the connection ceiling
    // and, under contention, individual queries queue past the default 5s
    // timeout — surfacing as random, run-to-run-varying failures in whichever DB
    // test happens to run at peak. Cap concurrency so total connections stay
    // comfortably bounded (≈4×10), and give queries headroom under load.
    poolOptions: { forks: { minForks: 1, maxForks: 4 } },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
