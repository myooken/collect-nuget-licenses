import { execFileSync } from "node:child_process";
import path from "node:path";

// NuGet の global-packages パスを dotnet CLI から取得
export function getGlobalPackagesFolder() {
  if (process.env.NUGET_PACKAGES) return path.resolve(process.env.NUGET_PACKAGES);
  let out = "";
  try {
    out = execFileSync("dotnet", ["nuget", "locals", "global-packages", "-l"], {
      encoding: "utf8",
    });
  } catch {
    throw new Error("Failed to run `dotnet nuget locals global-packages -l`. Make sure the .NET SDK is installed and on PATH.");
  }
  const m = out.match(/global-packages:\s*(.+)\s*$/im);
  if (!m) throw new Error(`Could not locate global-packages folder from output: ${out}`);
  return m[1].trim();
}
