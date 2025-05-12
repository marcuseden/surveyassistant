#!/bin/bash
set -e

echo "=== DEEP CLEANING OF PROJECT ==="
echo "Stopping any running Next.js servers..."
pkill -f 'node.*next' || true

echo "Removing .next directory..."
rm -rf .next

echo "Removing node_modules..."
rm -rf node_modules

echo "Clearing npm cache..."
npm cache clean --force

echo "Reinstalling dependencies..."
npm install

echo "Running npm audit fix..."
npm audit fix --force || true

echo "Building project..."
npm run build

echo "Done! You can now run 'npm run dev' to start the development server." 