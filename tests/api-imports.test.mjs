import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const IMPORT_RE = /from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["']/g;

// 1. Vercel runs api/ as native ESM, so relative imports there need .js.
const apiRoot = path.join(process.cwd(), "api");
const missingExtensions = [];

for (const file of walk(apiRoot).filter((f) => f.endsWith(".ts"))) {
  for (const specifier of relativeImports(file)) {
    if (!specifier.endsWith(".js")) {
      missingExtensions.push(`${rel(file)}: ${specifier}`);
    }
  }
}

assert.deepEqual(
  missingExtensions,
  [],
  `Found relative imports without .js extensions:\n${missingExtensions.join("\n")}`,
);

// 2. Browser code may only import the dependency-free shared modules from
//    api/_lib. Anything else would pull Neon, Resend or env reads into the
//    client bundle.
const CLIENT_ALLOWED = new Set(["api/_lib/booking.ts", "api/_lib/brand.ts", "api/_lib/requestStatus.ts"]);
const srcRoot = path.join(process.cwd(), "src");
const forbidden = [];

for (const file of walk(srcRoot).filter((f) => /\.(ts|tsx)$/.test(f))) {
  for (const specifier of relativeImports(file)) {
    const resolved = rel(path.resolve(path.dirname(file), specifier)).replace(/\.js$/, ".ts");
    if (resolved.startsWith("api/") && !CLIENT_ALLOWED.has(resolved)) {
      forbidden.push(`${rel(file)}: ${specifier}`);
    }
  }
}

assert.deepEqual(
  forbidden,
  [],
  `Client code imports server-only modules:\n${forbidden.join("\n")}`,
);

console.log("api-imports: ok");

function relativeImports(file) {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(IMPORT_RE)].map((match) => match[1] ?? match[2]);
}

function rel(file) {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (statSync(fullPath).isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}
