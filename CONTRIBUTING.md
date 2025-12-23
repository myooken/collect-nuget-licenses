# Contributing

This repository is published to npm, so keep contributor-facing notes here and end-user docs in `README.md`.

## Development checks
- Syntax check all JS files: `npm run check`  
  (`scripts/check-syntax.js` runs `node --check` across `src/` and `bin/`).

## Notes
- Do not move end-user usage docs out of `README.md`.
- Keep credentials and tokens out of the repo (see AGENTS.md for security notes if present). 
