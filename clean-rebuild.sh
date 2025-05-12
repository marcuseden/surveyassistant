#!/bin/bash
set -e

echo "Stopping any running Next.js servers..."
pkill -f 'node.*next' || true

echo "Cleaning .next directory..."
rm -rf .next

echo "Clearing node_modules cache..."
npm cache clean --force

echo "Reinstalling dependencies..."
npm install

echo "Building project..."
npm run build

echo "Starting server..."
npm run dev 