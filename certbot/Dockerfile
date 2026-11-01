FROM certbot/certbot:v5.9.0@sha256:bc93cb710b413e6b456d622f9b0133b3e109c0a78c2ed9976af43d209b0a1805

RUN apk add --no-cache curl 'ca-certificates>=20261020-r0' \
    && PIP_CERT=/etc/ssl/certs/ca-certificates.crt python -m pip install --no-cache-dir --upgrade 'certifi>=2026.10.19' 'pip>=26.2.2' \
    && python -m pip uninstall -y uv
