import fs from "node:fs";
import path from "node:path";

export function tryFindNupkgInFolder(pkgDir, id, version) {
  const expected = path.join(pkgDir, `${id}.${version}.nupkg`);
  if (fs.existsSync(expected)) return expected;

  try {
    const entries = fs.readdirSync(pkgDir, { withFileTypes: true });
    const candidates = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".nupkg"))
      .map((e) => path.join(pkgDir, e.name));
    if (candidates.length === 1) return candidates[0];
    const match = candidates.find((c) => path.basename(c).toLowerCase() === `${id.toLowerCase()}.${version.toLowerCase()}.nupkg`);
    if (match) return match;
    if (candidates.length > 0) return candidates[0];
  } catch {
    // ignore directory read errors
  }

  return expected;
}
