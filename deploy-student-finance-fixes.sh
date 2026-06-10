#!/bin/bash
# ScholarNerve — deploy student inactive + payment optimistic update fixes
# Runs DB migration, builds frontend/backend, restarts PM2.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 [ScholarNerve] Deploying student inactive + payment fixes..."

echo "📥 Pulling latest changes..."
git pull || echo "⚠️  Git pull skipped or failed — continuing with local tree."

echo "🗄️  Running database migrations..."
cd "$PROJECT_ROOT/backend"
npm install
npm run migrate

echo "📦 Building backend..."
npm run build

echo "📦 Building frontend..."
cd "$PROJECT_ROOT"
npm install
npm run build

if command -v pm2 &> /dev/null; then
  echo "🔄 Restarting backend via PM2..."
  pm2 restart scholarnerve-backend || pm2 restart all || pm2 start "$PROJECT_ROOT/backend/dist/index.js" --name "scholarnerve-backend"
else
  echo "🔄 PM2 not found — try: sudo systemctl restart scholarnerve"
  sudo systemctl restart scholarnerve 2>/dev/null || echo "⚠️  Restart backend manually."
fi

echo "✅ Deploy complete."
echo "   • Students: DELETE removed; use PATCH /api/students/:id/status"
echo "   • Payments: optimistic UI updates (no full dashboard refetch on each payment)"
echo "   • Migration: financial FK constraints ON DELETE SET NULL applied"
