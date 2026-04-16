import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { readFileSync } from "fs";
import { resolve } from "path";

// Lê o .env.production diretamente via fs para garantir que as vars estejam disponíveis
function parseEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    });
  } catch { /* arquivo não encontrado */ }
}

if (process.env.DEPLOY_ENV === "production") {
  parseEnvFile(resolve(process.cwd(), ".env.production"));
} else {
  config({ path: ".env.local" });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node --compiler-options '{\"module\":\"CommonJS\"}' ./prisma/seed.ts",
  },
});
