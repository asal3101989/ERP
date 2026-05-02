#!/bin/bash
# scripts/setup-server.sh
# One-time setup for E2E Networks VPS (Ubuntu 22.04 LTS)
# Usage: bash scripts/setup-server.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

DOMAIN="app.bcim.in"
EMAIL="it@bcim.in"
APP_DIR="/opt/constructerp"
LOG_FILE="/var/log/erp-setup.log"

# Colours
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1" | tee -a $LOG_FILE; }
warn() { echo -e "${YELLOW}[!]${NC} $1" | tee -a $LOG_FILE; }
err()  { echo -e "${RED}[✗]${NC} $1" | tee -a $LOG_FILE; exit 1; }

echo "============================================" | tee $LOG_FILE
echo " ConstructERP — E2E Networks Server Setup"  | tee -a $LOG_FILE
echo " Domain  : $DOMAIN"                          | tee -a $LOG_FILE
echo " Server  : $(hostname -I | awk '{print $1}')"| tee -a $LOG_FILE
echo " Started : $(date)"                          | tee -a $LOG_FILE
echo "============================================" | tee -a $LOG_FILE

# ── Must run as root ──────────────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && err "Run as root: sudo bash setup-server.sh"

# ── 1. System update ──────────────────────────────────────────────────────────
log "Step 1/9: Updating Ubuntu packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip nano htop \
  ufw fail2ban \
  ca-certificates gnupg lsb-release

# ── 2. Docker ─────────────────────────────────────────────────────────────────
log "Step 2/9: Installing Docker..."
if command -v docker &>/dev/null; then
  warn "Docker already installed: $(docker --version)"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

  systemctl enable docker
  systemctl start docker
  log "Docker installed: $(docker --version)"
fi

# ── 3. Swap (critical for 4GB RAM server) ─────────────────────────────────────
log "Step 3/9: Creating 2GB swap..."
if [ -f /swapfile ]; then
  warn "Swap already exists"
else
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10'           >> /etc/sysctl.conf
  sysctl -p -q
  log "Swap: $(free -h | grep Swap)"
fi

# ── 4. Firewall ───────────────────────────────────────────────────────────────
log "Step 4/9: Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
ufw --force enable
log "Firewall: $(ufw status | head -1)"

# ── 5. Fail2ban (brute force protection) ──────────────────────────────────────
log "Step 5/9: Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# ── 6. System tuning ──────────────────────────────────────────────────────────
log "Step 6/9: Tuning kernel for production..."
cat >> /etc/sysctl.conf << 'EOF'
# ConstructERP performance tuning
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_fin_timeout = 30
net.core.netdev_max_backlog = 5000
EOF
sysctl -p -q

# ── 7. App directory ──────────────────────────────────────────────────────────
log "Step 7/9: Setting up app directory..."
mkdir -p $APP_DIR/{backups,logs,nginx/ssl}
chmod 700 $APP_DIR/backups

# ── 8. Install Certbot + get SSL ─────────────────────────────────────────────
log "Step 8/9: Installing Certbot and getting SSL certificate..."
apt-get install -y -qq certbot

# Check DNS is pointing to this server first
CURRENT_IP=$(curl -s ifconfig.me)
DNS_IP=$(dig +short $DOMAIN @8.8.8.8 | head -1)

if [ "$CURRENT_IP" = "$DNS_IP" ]; then
  log "DNS OK — $DOMAIN → $CURRENT_IP"
  log "Getting SSL certificate (this may take 1-2 minutes)..."

  certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN,bcim.in,www.bcim.in" \
    --preferred-challenges http \
    && log "✅ SSL certificate issued for $DOMAIN" \
    || warn "SSL cert failed — retry after DNS propagates: certbot certonly --standalone -d $DOMAIN"
else
  warn "DNS not pointing to this server yet."
  warn "  This server IP : $CURRENT_IP"
  warn "  DNS resolves to: $DNS_IP"
  warn "  Add A record: app.bcim.in → $CURRENT_IP"
  warn "  Then run: certbot certonly --standalone -d app.bcim.in -d bcim.in -d www.bcim.in"
fi

# ── 9. Setup auto-renew cron ──────────────────────────────────────────────────
log "Step 9/9: Setting up SSL auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --pre-hook 'docker compose -f $APP_DIR/docker-compose.prod.yml stop nginx' --post-hook 'docker compose -f $APP_DIR/docker-compose.prod.yml start nginx' >> /var/log/certbot-renew.log 2>&1") | crontab -

# ── Setup daily DB backup cron ────────────────────────────────────────────────
(crontab -l 2>/dev/null; echo "0 2 * * * docker exec erp_db pg_dump -U erp_user construct_erp > $APP_DIR/backups/db_\$(date +\%Y\%m\%d).sql 2>/dev/null && find $APP_DIR/backups -name 'db_*.sql' -mtime +7 -delete") | crontab -
log "Auto-backup cron set (daily at 2 AM, keeps 7 days)"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo -e " ${GREEN}✅ Server setup complete!${NC}"
echo " Server IP : $CURRENT_IP"
echo ""
echo " NEXT STEPS:"
echo " 1. Upload project to $APP_DIR"
echo "    scp -r ./construct-erp/ root@$CURRENT_IP:$APP_DIR/"
echo ""
echo " 2. Create env file:"
echo "    cp $APP_DIR/.env.production.example $APP_DIR/.env.production"
echo "    nano $APP_DIR/.env.production"
echo ""
echo " 3. Deploy:"
echo "    bash $APP_DIR/scripts/deploy.sh"
echo ""
echo " 4. Open: https://app.bcim.in"
echo "============================================"
