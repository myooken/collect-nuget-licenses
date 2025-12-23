import fsp from "node:fs/promises";
import path from "node:path";
import { decodeSmart } from "./encoding.js";

const SKIP_DIRS = new Set(["node_modules", ".git", ".vs"]);

// Concurrent, dependency-free directory walk with a simple queue to avoid deep recursion.
async function findFiles(root, matcher, { concurrency = 8 } = {}) {
  const hits = [];
  const queue = [root];
  let active = 0;

  return new Promise((resolve) => {
    const processDir = async (dir) => {
      let entries;
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const name = entry.name;
        const full = path.join(dir, name);
        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(name)) continue;
          queue.push(full);
        } else if (matcher(name)) {
          hits.push(full);
        }
      }
    };

    const runNext = () => {
      while (active < concurrency && queue.length > 0) {
        const dir = queue.pop();
        active += 1;
        processDir(dir).finally(() => {
          active -= 1;
          if (queue.length === 0 && active === 0) resolve(hits);
          else runNext();
        });
      }
      if (queue.length === 0 && active === 0) resolve(hits);
    };

    runNext();
  });
}

function parseLibraryKey(key) {
  const idx = key.lastIndexOf("/");
  if (idx === -1) return null;
  return { id: key.slice(0, idx), version: key.slice(idx + 1) };
}

// project.assets.json から package type のみ抽出
async function parseAssetsFile(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    const libs = json?.libraries || {};
    const list = [];
    for (const [k, v] of Object.entries(libs)) {
      if (v.type !== "package") continue;
      const parsed = parseLibraryKey(k);
      if (!parsed) continue;
      list.push({ ...parsed, from: filePath });
    }
    return list;
  } catch {
    return [];
  }
}

async function parsePackagesConfig(filePath) {
  try {
    const raw = await fsp.readFile(filePath);
    const xml = decodeSmart(raw);
    const matches = [...xml.matchAll(/<package\b[^>]*?>/gims)];
    const items = [];
    for (const m of matches) {
      const tag = m[0];
      const attrs = {};
      const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = attrRe.exec(tag))) {
        const key = a[1].toLowerCase();
        const val = a[2] ?? a[3] ?? "";
        attrs[key] = val;
      }
      const id = attrs.id;
      const version = attrs.version;
      if (id && version) items.push({ id, version, from: filePath });
    }
    return items;
  } catch {
    return [];
  }
}

export async function getPackagesFromAssets(root) {
  const files = await findFiles(root, (name) => name.toLowerCase() === "project.assets.json");
  const all = [];
  for (const f of files) {
    const arr = await parseAssetsFile(f);
    all.push(...arr);
  }
  return all;
}

export async function getPackagesFromPackagesConfig(root) {
  const files = await findFiles(root, (name) => name.toLowerCase() === "packages.config");
  const all = [];
  for (const f of files) {
    const arr = await parsePackagesConfig(f);
    all.push(...arr);
  }
  return all;
}

export function dedupePackages(list) {
  const map = new Map();
  for (const p of list) {
    if (!p.id || !p.version) continue;
    const key = `${p.id.toLowerCase()}@${p.version}`;
    if (!map.has(key)) map.set(key, { id: p.id, version: p.version });
  }
  return [...map.values()].sort((a, b) => {
    const ai = a.id.toLowerCase();
    const bi = b.id.toLowerCase();
    if (ai === bi) return a.version.localeCompare(b.version, "en", { numeric: true });
    return ai.localeCompare(bi, "en");
  });
}

const LICENSE_PATTERN = /^(license|licence|notice|copying)(\.[a-z0-9]+)?$/i;

// パッケージルート直下の LICENSE 類似ファイルを収集
export async function getLicenseLikeFilesInFolderRoot(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (LICENSE_PATTERN.test(entry.name)) files.push(path.join(dir, entry.name));
  }
  return files.sort((a, b) => a.localeCompare(b, "en"));
}
