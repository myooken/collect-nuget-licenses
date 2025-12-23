import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseArgs } from "./args.js";
import { getGlobalPackagesFolder } from "./dotnet.js";
import { getPackagesFromAssets, getPackagesFromPackagesConfig, dedupePackages } from "./scan.js";
import { generateNotices } from "./notices.js";
import { loadPreviousSections } from "./previous.js";
import { writeReviewFile } from "./review.js";

function warn(msg) {
  console.warn(`warning: ${msg}`);
}

function writeHeader(w, { root, globalPackages }) {
  w("# Third-Party Notices (NuGet)");
  w("");
  w("Format-Version: 1");
  w(`Generated-By: collect-nuget-licenses`);
  w("");
  w(`Generated from: ${root}`);
  w(`NuGet global-packages: ${globalPackages}`);
  w("");
}

function writeSummary(w, missing, carriedCount) {
  w("---");
  w("");
  w("## Warnings summary");
  w("");

  const writeList = (title, arr) => {
    w(`### ${title}`);
    w("");
    if (arr.length === 0) w("- (none)");
    else for (const x of [...arr].sort()) w(`- ${x}`);
    w("");
  };

  writeList("Missing nuspec", missing.nuspec);
  writeList("Missing Source URL in nuspec", missing.sourceUrl);
  writeList("Missing license metadata in nuspec", missing.licenseMeta);
  writeList("Missing nupkg", missing.nupkg);
  writeList("Missing LICENSE/NOTICE/COPYING files", missing.licenseFiles);

  if (carriedCount > 0) {
    w("## Carried-forward packages");
    w("");
    w(`- count: ${carriedCount}`);
    w("");
  }
}

export async function run(argv) {
  const args = parseArgs(argv);
  const root = path.resolve(args.root);
  const outFile = path.resolve(args.out);
  const reviewFile = path.resolve(args.reviewOut);

  const globalPackages = getGlobalPackagesFolder();
  if (!fs.existsSync(globalPackages)) {
    throw new Error(`NuGet global-packages folder not found: ${globalPackages}`);
  }

  const allPackages = [
    ...(await getPackagesFromAssets(root)),
    ...(await getPackagesFromPackagesConfig(root)),
  ];
  const packages = dedupePackages(allPackages);
  const packageMap = new Map();
  for (const p of packages) {
    const key = `${p.id.toLowerCase()}@${p.version}`;
    if (packageMap.has(key)) warn(`Duplicate package detected: ${key} (keeping first)`);
    else packageMap.set(key, p);
  }

  const { sections: previousSections, carriedTag } = args.update
    ? loadPreviousSections(outFile, warn)
    : { sections: new Map(), carriedTag: null };
  const unionKeys = [...new Set([...packageMap.keys(), ...previousSections.keys()])].sort((a, b) => a.localeCompare(b, "en"));

  const tmpOut = `${outFile}.tmp`;
  const ws = fs.createWriteStream(tmpOut, { encoding: "utf8" });
  const w = (line = "") => ws.write(line + os.EOL);

  writeHeader(w, { root, globalPackages });

  const { reviewItems, missing, carriedCount } = await generateNotices({
    unionKeys,
    packageMap,
    previousSections,
    carriedTag,
    globalPackages,
    w,
    warn,
  });

  writeSummary(w, missing, carriedCount);
  await new Promise((r) => ws.end(r));

  const tmpReview = `${reviewFile}.tmp`;
  await writeReviewFile(reviewItems, { filePath: tmpReview, root, outFile });
  fs.renameSync(tmpReview, reviewFile);
  fs.renameSync(tmpOut, outFile);

  console.log(`Generated: ${outFile}`);
  console.log(`Review:    ${reviewFile}`);
  console.log(`Packages: ${packages.length}`);
  console.log(`Missing LICENSE files: ${missing.licenseFiles.length}`);

  if (missing.licenseFiles.length > 0 && args.failOnMissing) process.exit(1);
}
