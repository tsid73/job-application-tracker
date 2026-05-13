#!/usr/bin/env bash
set -euo pipefail

# Generic EC2 Ubuntu user data for hosting Node.js apps.
# This prepares the server only. Deploy apps after SSH.

export DEBIAN_FRONTEND=noninteractive

NODE_MAJOR="20"

log() {
  printf '[user-data] %s\n' "$1"
}

wait_for_apt() {
  while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
    log "Waiting for apt locks"
    sleep 5
  done
}

log "Installing base packages"
wait_for_apt
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl git gnupg nginx postgresql-client ufw

log "Installing Node.js ${NODE_MAJOR}"
install -d -m 0755 /etc/apt/keyrings
curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
wait_for_apt
apt-get update
apt-get install -y nodejs

log "Starting Nginx"
systemctl enable --now nginx

log "Configuring firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

log "EC2 bootstrap complete"
node --version
npm --version
nginx -v
