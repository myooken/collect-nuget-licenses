#!/usr/bin/env node
import { run } from "../src/cli.js";

async function main() {
  try {
    await run(process.argv.slice(2));
  } catch (e) {
    console.error(e?.stack || String(e));
    process.exit(2);
  }
}

main();
