FROM node:22.23.4-bookworm@sha256:82693da96a4e38b8c0e2bf0c5df58fcb86d2d25e5a235c07748f09bfa38567c2 AS builder
WORKDIR /app
ENV ONNXRUNTIME_NODE_INSTALL=skip
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build:command && npm prune --omit=dev

FROM node:22.23.4-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d
WORKDIR /app

ENV TZ=UTC
ENV PM2_HOME=/home/node/.pm2
ENV PATH=/app/node_modules/.bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates motion ffmpeg postgresql-client gosu \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

RUN chmod +x entrypoint.sh \
    && mkdir -p /app/log /home/node/.pm2 \
    && chown -R node:node /app /home/node

EXPOSE 80 443

ENTRYPOINT ["./entrypoint.sh"]
