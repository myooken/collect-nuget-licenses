import fs from "node:fs";
import path from "node:path";
import { decodeSmart } from "./encoding.js";
import { readNuspecMetadata } from "./nuspec.js";
import { getLicenseLikeFilesInFolderRoot } from "./scan.js";
import { tryFindNupkgInFolder, getLicenseTextsFromNupkg } from "./zip/index.js";
import { mdCodeFenceText, makeAnchorId } from "./md.js";

function warnDefault(msg) {
  console.warn(`warning: ${msg}`);
}

async function readLicenseFiles(filePaths) {
  const entries = [];
  for (const filePath of filePaths) {
    const name = path.basename(filePath);
    const text = decodeSmart(await fs.promises.readFile(filePath));
    entries.push({ name, text });
  }
  return entries;
}

function writeLicenseBlocks(w, blocks) {
  for (const block of blocks) {
    w(`### ${block.name}`);
    w("```text");
    w(mdCodeFenceText(block.text).replace(/\s+$/, ""));
    w("```");
    w("");
  }
}

async function writeCurrentPackage({ w, pkg, key, anchor, globalPackages, missing, reviewItems, warn }) {
  const pkgDir = path.join(globalPackages, pkg.id.toLowerCase(), pkg.version);
  const nuspec = path.join(pkgDir, `${pkg.id}.nuspec`);

  const flags = [];
  const filesForReview = [];

  w(`<a id="${anchor}"></a>`);
  w(`## ${key}`);
  w("Status: current");

  let meta = {
    repoUrl: null,
    projectUrl: null,
    licenseText: null,
    licenseType: null,
    licenseUrl: null,
  };

  if (!fs.existsSync(nuspec)) {
    missing.nuspec.push(key);
    flags.push("Missing nuspec");
    warn(`nuspec not found: ${key} (expected: ${nuspec})`);
  } else {
    meta = await readNuspecMetadata(nuspec);
  }

  let sourceLine = null;
  if (meta.repoUrl) sourceLine = `Source: ${meta.repoUrl}`;
  else if (meta.projectUrl) sourceLine = `Source: ${meta.projectUrl}`;
  else {
    missing.sourceUrl.push(key);
    flags.push("Missing Source URL in nuspec");
    warn(`Source URL missing in nuspec: ${key}`);
  }

  let licenseLine = null;
  if (meta.licenseType && meta.licenseText) licenseLine = `License: ${meta.licenseType} ${meta.licenseText}`;
  else if (meta.licenseText) licenseLine = `License: ${meta.licenseText}`;
  else if (meta.licenseUrl) licenseLine = `LicenseUrl: ${meta.licenseUrl}`;
  else {
    missing.licenseMeta.push(key);
    flags.push("Missing license metadata in nuspec");
    warn(`License metadata missing in nuspec: ${key}`);
  }

  if (sourceLine) w(sourceLine);
  if (licenseLine) w(licenseLine);
  w("");

  const licFiles = await getLicenseLikeFilesInFolderRoot(pkgDir);
  if (licFiles.length > 0) {
    for (const filePath of licFiles) filesForReview.push(path.basename(filePath));
    const blocks = await readLicenseFiles(licFiles);
    writeLicenseBlocks(w, blocks);
    reviewItems.push({ key, anchor, status: "current", source: sourceLine, licenseLine, files: filesForReview, flags });
    return;
  }

  const nupkg = tryFindNupkgInFolder(pkgDir, pkg.id, pkg.version);
  if (!fs.existsSync(nupkg)) {
    missing.nupkg.push(key);
    flags.push("Missing nupkg");
    warn(`nupkg not found: ${key} (searched: ${pkgDir})`);
  }

  let zipTexts = [];
  try {
    zipTexts = await getLicenseTextsFromNupkg(nupkg);
  } catch (e) {
    warn(`Failed to read nupkg: ${key} (${e.message || e})`);
  }

  if (zipTexts.length > 0) {
    for (const z of zipTexts) filesForReview.push(z.name);
    writeLicenseBlocks(w, zipTexts);
    reviewItems.push({ key, anchor, status: "current", source: sourceLine, licenseLine, files: filesForReview, flags });
    return;
  }

  missing.licenseFiles.push(key);
  flags.push("Missing LICENSE/NOTICE/COPYING files");
  warn(`LICENSE/NOTICE/COPYING not found: ${key} (searched: ${pkgDir}, nupkg)`);
  w("_No LICENSE/NOTICE/COPYING file found in NuGet package (folder root or nupkg)._");
  w("");

  reviewItems.push({ key, anchor, status: "current", source: sourceLine, licenseLine, files: filesForReview, flags });
}

function writeCarriedSection({ w, title, anchor, carriedTag, prevBody, reviewItems }) {
  w(`<a id="${anchor}"></a>`);
  w(`## ${title}`);
  w("Status: carried (not present in current scan)");
  if (carriedTag) w(`Carried-From: ${carriedTag}`);
  w("");
  for (const line of prevBody.split(/\r?\n/)) w(line);
  reviewItems.push({
    key: title,
    anchor,
    status: "carried",
    files: ["(from previous report)"],
    flags: ["Not present in current scan (carried from previous report)"],
  });
}

export async function generateNotices({ unionKeys, packageMap, previousSections, carriedTag, globalPackages, w, warn = warnDefault }) {
  const reviewItems = [];
  const missing = { nuspec: [], sourceUrl: [], licenseMeta: [], nupkg: [], licenseFiles: [] };
  let carriedCount = 0;

  for (const key of unionKeys) {
    const pkg = packageMap.get(key);
    const prev = previousSections.get(key);
    const displayTitle = pkg ? `${pkg.id}@${pkg.version}` : prev?.title ?? key;
    const anchor = makeAnchorId(displayTitle);

    if (!pkg) {
      if (!prev) continue;
      carriedCount += 1;
      writeCarriedSection({ w, title: displayTitle, anchor, carriedTag, prevBody: prev.body, reviewItems });
      continue;
    }

    await writeCurrentPackage({ w, pkg, key: displayTitle, anchor, globalPackages, missing, reviewItems, warn });
  }

  return { reviewItems, missing, carriedCount };
}
