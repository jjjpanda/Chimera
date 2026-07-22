#!/bin/sh
set -e

echo "→ Fixing ownership on mounted volumes..."
mkdir -p /mnt/storage/shared/captures /app/.well-known/acme-challenge
chmod 2775 /app/.well-known /app/.well-known/acme-challenge
chown node:node /mnt/storage /mnt/storage/shared /mnt/storage/shared/captures \
                /app/.well-known /app/.well-known/acme-challenge
chown -R node:node /etc/motion/cameraconf

echo "→ Validating environment variables..."
gosu node node chimera/validateEnvVars.js

echo "→ Preparing database..."
gosu node node chimera/prepareDatabase.js

echo "→ Starting PM2..."
exec gosu node pm2-runtime pm2.config.js
