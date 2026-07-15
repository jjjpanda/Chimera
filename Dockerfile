FROM node:22 AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build:command && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app

ENV TZ=UTC
ENV PM2_HOME=/home/node/.pm2

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates motion ffmpeg postgresql-client gosu \
    && npm install -g pm2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

RUN chmod +x entrypoint.sh \
    && mkdir -p /app/log /home/node/.pm2 \
    && chown -R node:node /app /home/node

EXPOSE 80 443

ENTRYPOINT ["./entrypoint.sh"]
