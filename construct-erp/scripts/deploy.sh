#!/bin/bash
# scripts/deploy.sh
# Deploy / update ConstructERP on Hetzner VPS
# Run from: /opt/constructerp
# Usage   : bash scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

APP_DIR="/opt/constructerp"
COMPOSE="docker compose -f docker-compose.prod.yml"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd "$APP_DIR"

echo "============================================"
echo " ConstructERP Deploy — $TIMESTAMP"
echo "============================================"

# ── Check .env.production exists ──────────────────────────────────────────────
if [ ! -f .env.production ]; then
  echo "❌ .env.production not found!"
  echo "   cp .env.production.example .env.production"
  echo "   nano .env.production  (fill in all values)"
  exit 1
fi

# Load env for this script
export $(grep -v '^#' .env.production | xargs)

# ── Pull latest code (if using git) ──────────────────────────────────────────
if [ -d .git ]; then
  echo "[1/5] Pulling latest code..."
  git pull origin main
else
  echo "[1/5] Skipping git pull (no .git directory)"
fi

# ── Build Docker images ───────────────────────────────────────────────────────
echo "[2/5] Building Docker images..."
$COMPOSE build --no-cache backend frontend

# ── Database backup before update ─────────────────────────────────────────────
echo "[3/5] Backing up database..."
BACKUP_FILE="backups/db_backup_$TIMESTAMP.sql"
mkdir -p backups

if docker ps --format '{{.Names}}' | grep -q "erp_db"; then
  docker exec erp_db pg_dump -U erp_user construct_erp > "$BACKUP_FILE" 2>/dev/null \
    && echo "   Backup saved: $BACKUP_FILE" \
    || echo "   ⚠ Backup failed (continuing anyway)"
  # Keep only last 7 backups
  ls -t backups/db_backup_*.sql 2>/dev/null | tail -n +8 | xargs rm -f
else
  echo "   DB not running yet — skipping backup"
fi

# ── Deploy ────────────────────────────────────────────────────────────────────
echo "[4/5] Deploying containers..."
$COMPOSE up -d --remove-orphans

# ── Health check ──────────────────────────────────────────────────────────────
echo "[5/5] Health check..."
sleep 10

MAX_RETRIES=6
for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Backend healthy (attempt $i)"
    break
  else
    echo "   ⏳ Waiting for backend... ($i/$MAX_RETRIES)"
    sleep 10
  fi
  if [ $i -eq $MAX_RETRIES ]; then
    echo "   ❌ Backend not responding after ${MAX_RETRIES} attempts"
    echo "   Check logs: docker compose -f docker-compose.prod.yml logs backend"
    exit 1
  fi
done

echo ""
echo "============================================"
echo " ✅ Deployment successful!"
echo " 🌐 https://app.bcim.in"
echo " 📊 Status: docker compose -f docker-compose.prod.yml ps"
echo " 📋 Logs  : docker compose -f docker-compose.prod.yml logs -f"
echo "============================================"
