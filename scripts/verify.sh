#!/usr/bin/env bash
set -euo pipefail

echo "==> Server tests"
cd server && npm run test && cd ..

echo "==> TypeScript (frontend)"
npx tsc --noEmit

echo "==> TypeScript (server)"
cd server && npx tsc --noEmit && cd ..

echo "==> Build"
npm run build

echo "All checks passed."
