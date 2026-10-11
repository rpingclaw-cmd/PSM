#!/usr/bin/env bash
# Daily Quote Cards — one-command setup for a free Ubuntu server (e.g. Oracle Cloud Always Free).
# Usage:  curl -fsSL https://raw.githubusercontent.com/rpingclaw-cmd/PSM/main/server/setup.sh | sudo bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
REPO="${REPO:-https://github.com/rpingclaw-cmd/PSM.git}"
APP=/opt/quotecards/app
DATA=/var/lib/quotecards

say(){ printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo."; exit 1; }

DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ]; then read -rp "Your web address (e.g. pranahuti-quotes.duckdns.org): " DOMAIN </dev/tty; fi
DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN%%/*}"
if [ -z "${QUOTEAPP:-}" ]; then
  if [ -f /etc/quotecards.env ] && grep -q '^QUOTEAPP=' /etc/quotecards.env; then
    QUOTEAPP="$(grep '^QUOTEAPP=' /etc/quotecards.env | cut -d= -f2-)"; echo "Keeping your existing app password."
  else
    read -rsp "Choose your app password (you type it in the app's Setup): " QUOTEAPP </dev/tty; echo
  fi
fi
DUCK="${DUCKDNS_TOKEN:-}"
if [ -z "$DUCK" ] && [[ "$DOMAIN" == *.duckdns.org ]]; then read -rp "DuckDNS token (optional — press Enter to skip): " DUCK </dev/tty || true; fi

say "Installing system updates and tools"
apt-get update -y
apt-get install -y git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https netfilter-persistent iptables-persistent

if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  say "Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  say "Installing Caddy (gives your site free HTTPS)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

# Small servers (1 GB) get a little swap so updates never run out of memory
if [ "$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)" -lt 2000 ] && ! swapon --show | grep -q swapfile; then
  say "Adding 1 GB swap"; fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "Getting the app from GitHub"
id quotecards >/dev/null 2>&1 || useradd --system --home /opt/quotecards --shell /usr/sbin/nologin quotecards
mkdir -p /opt/quotecards "$DATA"
if [ -d "$APP/.git" ]; then git -C "$APP" fetch -q && git -C "$APP" reset -q --hard origin/HEAD; else git clone -q "$REPO" "$APP"; fi
chown -R quotecards:quotecards "$DATA"

cat > /etc/quotecards.env <<EOF
QUOTEAPP=$QUOTEAPP
URL=https://$DOMAIN
DATA_DIR=$DATA
PORT=8080
EOF
chmod 600 /etc/quotecards.env

cat > /etc/systemd/system/quotecards.service <<'EOF'
[Unit]
Description=Daily Quote Cards
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/quotecards.env
ExecStart=/usr/bin/node /opt/quotecards/app/server/server.mjs
User=quotecards
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  request_body {
    max_size 40MB
  }
  reverse_proxy 127.0.0.1:8080
}
EOF

say "Opening ports 80 and 443"
for p in 80 443; do iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport $p -j ACCEPT; done
netfilter-persistent save >/dev/null 2>&1 || true

say "Automatic updates from GitHub (every 5 minutes) and daily backups"
cat > /usr/local/bin/quotecards-update <<'EOF'
#!/usr/bin/env bash
cd /opt/quotecards/app || exit 0
git fetch -q || exit 0
if [ "$(git rev-parse HEAD)" != "$(git rev-parse @{u})" ]; then
  old=$(git rev-parse HEAD); git reset -q --hard @{u}
  if ! git diff --quiet "$old" HEAD -- server netlify; then systemctl restart quotecards; fi
fi
EOF
chmod +x /usr/local/bin/quotecards-update
mkdir -p /var/backups/quotecards
cat > /etc/cron.d/quotecards <<EOF
*/5 * * * * root /usr/local/bin/quotecards-update >/dev/null 2>&1
17 3 * * * root tar czf /var/backups/quotecards/data-\$(date +\\%F).tgz -C $DATA . && find /var/backups/quotecards -name 'data-*.tgz' -mtime +14 -delete
EOF
if [ -n "$DUCK" ]; then
  SUB="${DOMAIN%%.duckdns.org}"
  echo "*/10 * * * * root curl -fsS 'https://www.duckdns.org/update?domains=$SUB&token=$DUCK&ip=' >/dev/null 2>&1" >> /etc/cron.d/quotecards
  curl -fsS "https://www.duckdns.org/update?domains=$SUB&token=$DUCK&ip=" >/dev/null || true
fi

systemctl daemon-reload
systemctl enable --now quotecards
systemctl restart quotecards
systemctl reload caddy || systemctl restart caddy

say "Checking"
sleep 3
if curl -fsS http://127.0.0.1:8080/healthz >/dev/null; then echo "App is running."; else echo "App did not start — run: journalctl -u quotecards -n 50"; fi
echo
echo "Done! Open  https://$DOMAIN  (the HTTPS certificate can take 1–2 minutes the first time)."
echo "Your app password is the one you just typed. To change it later, run this script again."
