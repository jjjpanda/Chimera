FROM node:22 AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build:command && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app

ENV TZ=UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates motion ffmpeg postgresql-client libcap2-bin \
    && npm install -g pm2 \
    && setcap cap_net_bind_service=+ep "$(readlink -f "$(command -v node)")" \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node --from=builder /app ./

# node is the non-root user shipped in the base image; the gateway binds 80/443,
# so the setcap above lets it hold those privileged ports without root.
# Volume mount points must exist and be node-owned so the named volumes
# (storage captures, acme-webroot) inherit non-root ownership and stay writable.
RUN chmod +x entrypoint.sh \
    && mkdir -p /mnt/storage /app/.well-known \
    && chown node:node /mnt/storage /app/.well-known

USER node

EXPOSE 80 443

ENTRYPOINT ["./entrypoint.sh"]
