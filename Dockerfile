FROM node:26.13.1-bookworm@sha256:b7087bc4d973034b30854b378ba107f9fab622b47514cb7e2592e41b8bab8d49 AS builder
WORKDIR /app
ENV ONNXRUNTIME_NODE_INSTALL=skip
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build:command && npm prune --omit=dev

FROM node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1
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
