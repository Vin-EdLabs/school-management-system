#!/bin/bash
# ScholarNerve VPS Deployment Script
# This script pulls changes, installs frontend & backend dependencies, rebuilds the frontend, and restarts the backend process using PM2.

# Exit immediately if any command fails
set -e

# Define root directory (assuming script is run from project root)
PROJECT_ROOT="$(pwd)"

echo "🚀 [ScholarNerve Deploy] Starting deployment..."

# 1. Pull changes
echo "📥 [ScholarNerve Deploy] Pulling latest git changes..."
git pull || echo "⚠️  Git pull failed (perhaps not a git repo or no upstream configured). Continuing..."

# 2. Frontend Build
echo "📦 [ScholarNerve Deploy] Building frontend..."
npm install
npm run build

# 3. Backend Install, Migrate, and Restart
echo "⚙️  [ScholarNerve Deploy] Updating backend..."
cd "$PROJECT_ROOT/backend"
npm install
npm run build
npm run migrate

if command -v pm2 &> /dev/null; then
    echo "🔄 [ScholarNerve Deploy] Restarting backend via PM2..."
    # Attempt to restart by name, fall back to restarting all if name isn't active
    pm2 restart scholarnerve-backend || pm2 restart all || pm2 start src/index.ts --name "scholarnerve-backend"
else
    echo "🔄 [ScholarNerve Deploy] PM2 not found. Attempting backend restart via systemctl..."
    sudo systemctl restart scholarnerve || echo "⚠️  Could not restart systemctl service. Please restart the backend manually."
fi

echo "✅ [ScholarNerve Deploy] Rebuild and restart complete! Nginx will serve the new build automatically from the dist/ folder."
