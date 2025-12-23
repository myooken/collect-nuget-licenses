# example-run.ps1
# Run at a .NET project root

npx --yes --package=@myooken/collect-nuget-licenses -- nuget-notices `
  --root . `
  --out THIRD-PARTY-LICENSE-NUGET.md `
  --review-out THIRD-PARTY-LICENSE-NUGET-REVIEW.md
