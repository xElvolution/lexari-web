#!/usr/bin/env node
// Runs the TypeScript CLI (and your TypeScript agent) through tsx.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), join(here, "../src/main.ts"), ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, TSX_TSCONFIG_PATH: process.env.TSX_TSCONFIG_PATH || join(here, "../../../tsconfig.json") } });
process.exit(r.status ?? 1);
