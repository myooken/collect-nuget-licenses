const DEFAULTS = {
  root: ".",
  out: "THIRD-PARTY-LICENSE-NUGET.md",
  reviewOut: "THIRD-PARTY-LICENSE-NUGET-REVIEW.md",
  failOnMissing: false,
  update: false,
};

function printHelp() {
  console.log(`Usage:
  nuget-notices [--root <dir>] [--out <file>] [--review-out <file>] [--fail-on-missing] [--update]
`);
}

// コマンドライン引数を最小限でパースする
export function parseArgs(argv) {
  const args = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) args.root = argv[++i];
    else if (a === "--out" && argv[i + 1]) args.out = argv[++i];
    else if ((a === "--review-out" || a === "--reviewOut") && argv[i + 1]) args.reviewOut = argv[++i];
    else if (a === "--fail-on-missing") args.failOnMissing = true;
    else if (a === "--update") args.update = true;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}
