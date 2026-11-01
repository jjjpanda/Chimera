FROM node:26.13.0-bookworm@sha256:fa52d1669505e29b58c042875b1d65c229e0787a3610fd52869b22b68e480853 AS builder
WORKDIR /app
ENV ONNXRUNTIME_NODE_INSTALL=skip
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build:command && npm prune --omit=dev

FROM node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9
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
