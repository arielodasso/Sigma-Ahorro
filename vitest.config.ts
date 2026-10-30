import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    resolve: {
      alias: {
        "@/lib/money": new URL("./src/lib/money.ts", import.meta.url).pathname,
        "@/lib/dates": new URL("./src/lib/dates.ts", import.meta.url).pathname,
        "@/lib/finance": new URL("./src/lib/finance.ts", import.meta.url).pathname,
        "@/lib/parser": new URL("./src/lib/parser.ts", import.meta.url).pathname,
        "@/services": new URL("./src/services", import.meta.url).pathname,
        "@/types": new URL("./src/types/index.ts", import.meta.url).pathname,
        "@/lib/db": new URL("./src/lib/db", import.meta.url).pathname,
      },
    },
    coverage: {
      provider: "v8",
    },
  },
});