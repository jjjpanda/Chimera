#!/bin/sh
set -e

echo "→ Preparing database..."
node chimera/prepareDatabase.js

echo "→ Starting PM2..."
exec pm2-runtime pm2.config.js
