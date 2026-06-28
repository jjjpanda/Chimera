FROM node:22 AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run install:modules && npm run build:command && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app

ENV TZ=UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates motion ffmpeg postgresql-client \
    && npm install -g pm2 \
    && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/gateway/node_modules ./gateway/node_modules
COPY --from=builder /app/storage/node_modules ./storage/node_modules
COPY --from=builder /app/object/node_modules ./object/node_modules
COPY --from=builder /app/schedule/node_modules ./schedule/node_modules
COPY --from=builder /app/command/dist ./command/dist

RUN chmod +x entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["./entrypoint.sh"]
