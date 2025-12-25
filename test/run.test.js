import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { run } from "../src/cli.js";
import { dedupePackages, getPackagesFromAssets } from "../src/scan.js";

test("detects packages from project.assets.json", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "nuget-notices-"));
  const projectRoot = path.join(tmp, "sample-app");
  await mkdir(path.join(projectRoot, "obj"), { recursive: true });

  const assetsPath = path.join(projectRoot, "obj", "project.assets.json");
  await writeFile(
    assetsPath,
    JSON.stringify({
      libraries: {
        "Demo.Package/1.2.3": { type: "package" },
        "NotAPackage/2.0.0": { type: "project" },
      },
    }),
    "utf8",
  );

  const packages = await getPackagesFromAssets(projectRoot);
  assert.equal(packages.length, 1);
  assert.equal(packages[0].from, assetsPath);
  assert.deepEqual(dedupePackages(packages), [{ id: "Demo.Package", version: "1.2.3" }]);
});

test("run writes notices for detected NuGet packages", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "nuget-notices-"));
  const projectRoot = path.join(tmp, "proj");
  const objDir = path.join(projectRoot, "obj");
  await mkdir(objDir, { recursive: true });

  const assets = {
    libraries: {
      "Demo.Package/1.2.3": { type: "package" },
    },
  };
  await writeFile(path.join(objDir, "project.assets.json"), JSON.stringify(assets), "utf8");

  const globalPackages = path.join(tmp, "global-packages");
  const pkgDir = path.join(globalPackages, "demo.package", "1.2.3");
  await mkdir(pkgDir, { recursive: true });

  await writeFile(
    path.join(pkgDir, "Demo.Package.nuspec"),
    `<?xml version="1.0"?>
<package>
  <metadata>
    <id>Demo.Package</id>
    <version>1.2.3</version>
    <license type="expression">MIT</license>
    <projectUrl>https://example.com/demo</projectUrl>
    <repository url="https://github.com/example/demo" />
  </metadata>
</package>
`,
    "utf8",
  );
  await writeFile(path.join(pkgDir, "LICENSE"), "Demo license text\n", "utf8");

  const outFile = path.join(tmp, "THIRD-PARTY-LICENSE-NUGET.md");
  const reviewFile = path.join(tmp, "THIRD-PARTY-LICENSE-NUGET-REVIEW.md");

  const prevEnv = process.env.NUGET_PACKAGES;
  process.env.NUGET_PACKAGES = globalPackages;
  try {
    await run(["--root", projectRoot, "--out", outFile, "--review-out", reviewFile]);
  } finally {
    if (prevEnv === undefined) delete process.env.NUGET_PACKAGES;
    else process.env.NUGET_PACKAGES = prevEnv;
  }

  const outText = await readFile(outFile, "utf8");
  assert.match(outText, /Demo\.Package@1\.2\.3/);
  assert.match(outText, /Source: https:\/\/github\.com\/example\/demo/);
  assert.match(outText, /License: expression MIT/);
  assert.match(outText, /Demo license text/);

  const reviewText = await readFile(reviewFile, "utf8");
  assert.match(reviewText, /Review - Third-Party Notices/);
  assert.match(reviewText, /Demo\.Package@1\.2\.3/);
  assert.match(reviewText, /Files:\s*- LICENSE/);
});
