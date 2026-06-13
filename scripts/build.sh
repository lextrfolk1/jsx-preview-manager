#!/bin/bash
set -e

# Go to the project root directory
cd "$(dirname "$0")/.."

echo "========================================="
echo "Building JSX Preview Manager..."
echo "========================================="

# 1. Backend Build / Install
echo "Installing backend dependencies..."
cd backend
npm install
cd ..

# 2. Frontend Build
echo "Installing frontend dependencies..."
cd frontend
npm install

echo "Building frontend application..."
npm run build
cd ..

# 3. Consolidate Output for Cloudflare Pages / Vercel / Netlify
echo "Consolidating build output..."
rm -rf dist
cp -R frontend/dist ./dist

echo "========================================="
echo "Build complete!"
echo "Production files are located in the /dist/ directory"
echo "========================================="
