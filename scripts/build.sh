#!/bin/bash
set -e

echo "Building TypeScript scripts..."
npm run build

echo "TypeScript compilation complete!"
echo "Compiled files are in scripts-dist/ directory"