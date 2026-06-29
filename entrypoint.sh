#!/bin/sh
set -e

echo "→ Preparing acme challenge directory..."
mkdir -p ./.well-known/acme-challenge

echo "→ Validating environment variables..."
node chimera/validateEnvVars.js

echo "→ Preparing database..."
node chimera/prepareDatabase.js

echo "→ Starting PM2..."
exec pm2-runtime pm2.config.js
