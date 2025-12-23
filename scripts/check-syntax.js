#!/usr/bin/env node
// 全 .js ファイルに node --check をかける簡易スクリプト
import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && full.toLowerCase().endsWith(".js")) out.push(full);
  }
  return out;
}

const targets = [...listJsFiles("src"), ...listJsFiles("bin")];

let failed = false;
for (const file of targets) {
  const res = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (res.status !== 0) {
    failed = true;
    break;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("node --check passed for:", targets.length, "files");
}
