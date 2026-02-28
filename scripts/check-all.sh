#!/bin/bash
# Run all checks: typecheck, lint, test, build

set -e

echo "=== TypeCheck ==="
npm run typecheck

echo ""
echo "=== Lint ==="
npm run lint

echo ""
echo "=== Test ==="
npm test

echo ""
echo "=== Build ==="
npm run build

echo ""
echo "=== All checks passed! ==="
