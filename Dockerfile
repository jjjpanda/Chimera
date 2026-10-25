FROM node:26.12.1-bookworm@sha256:5c4012d11d9857c42713ba511fbc19645cac1706bb710d51d42b0d301dff7f88 AS builder
WORKDIR /app
ENV ONNXRUNTIME_NODE_INSTALL=skip
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge '20250419~deb12u2' \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build:command && npm prune --omit=dev

FROM node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe
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
