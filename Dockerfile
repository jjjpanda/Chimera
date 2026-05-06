FROM node:22 AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build:command && npm prune --omit=dev

FROM ubuntu:22.04
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl software-properties-common \
    && add-apt-repository universe \
    && apt-get update && apt-get install -y --no-install-recommends \
        motion ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pm2 \
    && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/command/build ./command/build

RUN chmod +x entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["./entrypoint.sh"]
