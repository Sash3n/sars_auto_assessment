import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // layout.tsx is the root html/body shell. It cannot be rendered inside
      // jsdom's container without hydration hacks, and the production build
      // exercises it on every CI run. firebase/client.ts is a set of thin
      // dynamic-import wrappers over the Firebase SDK that only execute
      // against a live Firebase project; its callers are tested with the
      // module mocked.
      exclude: [
        "src/**/*.d.ts",
        "src/app/layout.tsx",
        "src/lib/firebase/client.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
