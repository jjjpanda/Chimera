FROM node:22.22.0@sha256:20a424ecd1d2064a44e12fe287bf3dae443aab31dc5e0c0cb6c74bef9c78911c AS builder
WORKDIR /app
ENV ONNXRUNTIME_NODE_INSTALL=skip
COPY . .
RUN npm ci && npm run build:command && npm prune --omit=dev

FROM node:22.22.0-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94
WORKDIR /app

ENV TZ=UTC
ENV PM2_HOME=/home/node/.pm2
ENV PATH=/app/node_modules/.bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates motion ffmpeg postgresql-client gosu \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

RUN chmod +x entrypoint.sh \
    && mkdir -p /home/node/.pm2 \
    && chown -R node:node /app /home/node

EXPOSE 80 443

ENTRYPOINT ["./entrypoint.sh"]
