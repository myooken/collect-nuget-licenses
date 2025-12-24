# Third-Party Notices for NuGet packages

## What is this?

A CLI that scans NuGet dependencies and outputs third-party notices in Markdown. It reads `project.assets.json` / `packages.config`, pulls nuspec + license files from the NuGet global packages cache, and writes two files: the main notices document and a review checklist.

### Highlights

- **ESM / Node.js 18+**, zero dependencies
- Uses `.NET SDK` to locate the NuGet global-packages cache automatically
- Reads `project.assets.json` and `packages.config`, dedupes by `id@version`
- Embeds full LICENSE/NOTICE/COPYING texts from package roots or `.nupkg`
- Review file flags missing Source / license metadata; `--update` carries forward removed packages
- `--fail-on-missing` supports CI enforcement for missing license files

CLI command: `nuget-notices`

### Usage

#### Run without installing (recommended)

```bash
npx --package=@myooken/collect-nuget-licenses -- nuget-notices
```

#### Run via npm exec

```bash
npm exec --package=@myooken/collect-nuget-licenses -- nuget-notices
```

#### Install globally

```bash
npm i -g @myooken/collect-nuget-licenses
nuget-notices
```

### Options

| Option                | Description                                                                                 | Default                               |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| `--root <dir>`        | Solution / project root to scan for `project.assets.json` and `packages.config`             | `.`                                   |
| `--review-out [file]` | Write review file only; optional filename                                                   | `THIRD-PARTY-LICENSE-NUGET-REVIEW.md` |
| `--out [file]`        | Write main notices file only; optional filename                                             | `THIRD-PARTY-LICENSE-NUGET.md`        |
| `--update`            | Merge with existing outputs, keep removed packages, and mark them as carried                | `false`                               |
| `--fail-on-missing`   | Exit with code 1 if LICENSE/NOTICE/COPYING are missing for any package                      | `false`                               |
| `-h`, `--help`        | Show help                                                                                   | -                                     |

> If neither `--out` nor `--review-out` is specified, **both files are generated**.
> Packages in both files are sorted by `id@version`; `--update` keeps entries for packages no longer in the scan and annotates their status.

### Examples

```bash
# Default (both files, scan current directory)
nuget-notices

# Update existing files without dropping removed packages
nuget-notices --update

# Custom solution root and output paths
nuget-notices --root ./src/MySolution \
  --out ./out/THIRD-PARTY-LICENSE-NUGET.md \
  --review-out ./out/THIRD-PARTY-LICENSE-NUGET-REVIEW.md

# Exit with code 1 when license files are missing (with --fail-on-missing)
nuget-notices --fail-on-missing
```

### Programmatic API

```js
import { run } from "@myooken/collect-nuget-licenses";

await run([
  "--root",
  "./",
  "--out",
  "./THIRD-PARTY-LICENSE-NUGET.md",
  "--review-out",
  "./THIRD-PARTY-LICENSE-NUGET-REVIEW.md",
  // "--update",
]);
```

The function mirrors the CLI flags and is exported from the package root as the public entrypoint. Deep imports are not part of the supported API when using the package `exports` map.
Outputs are sorted by package key. Use `--update` to merge with existing files and keep packages that are no longer present, with their status shown in both outputs.

### Output overview

- **THIRD-PARTY-LICENSE-NUGET.md**
  - Header with source root and NuGet global-packages path
  - Per-package sections with Source / License lines
  - Full LICENSE/NOTICE/COPYING texts embedded as fenced code blocks
  - Status line shows whether the package is present in the current scan (current / carried)
  - Warnings summary for missing nuspec / source URL / license metadata / nupkg / license files
- **THIRD-PARTY-LICENSE-NUGET-REVIEW.md**
  - Review-oriented checklist with package status and anchors
  - Flags for missing metadata/files and file names to verify

### How it differs from typical NuGet license tools

- **Focused on bundling full license texts into a single Markdown file**
  - Prioritizes ready-to-share notices over JSON/CSV reports.
- **Separate review file** to track missing metadata and carried packages
  - Easier to integrate into audit workflows.
- **ESM / Node.js 18+ with no dependencies**
  - Simple runtime requirements.

### Notes

- Requires Node.js 18+ and the .NET SDK (`dotnet nuget locals global-packages -l` must work).
- Scans all `project.assets.json` and `packages.config` files under `--root`; license files are searched only in each package root directory or inside the `.nupkg`.
- Exit code 0: success. Exit code 1: missing license files when `--fail-on-missing` is set, or when the NuGet global-packages folder cannot be found.
- Missing `license` or `repository` metadata in nuspec files is flagged in the review output; packages without license files are reported in both files.
- `.nupkg` ZIP support: store (0) and deflate (8) only; other methods are skipped with a warning. Zip64 single-disk archives only; large archives that exceed JS safe integers are skipped with a warning.
- Filenames honor the ZIP UTF-8 flag; non-UTF-8 names are decoded best-effort with latin1. `.nupkg` files are read fully into memory (very large packages may use more RAM). Run `dotnet restore` first to populate the global cache.
- Set `NUGET_PACKAGES` to point to a custom global-packages location if your cache is not at the default `dotnet` location.
