#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Installing server dependencies..."
npm install --production

echo "Installing client dependencies..."
cd client
npm install
echo "Building client..."
npm run build
cd ..

echo "Build complete."
