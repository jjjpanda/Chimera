FROM certbot/certbot:v5.6.0@sha256:0107d084c225631fc64a8313e19adb07275f7296fde338f7dfa93986c80b2e3e

RUN apk add --no-cache curl 'ca-certificates>=20261020-r0' \
    && PIP_CERT=/etc/ssl/certs/ca-certificates.crt python -m pip install --no-cache-dir --upgrade 'certifi>=2026.10.19' 'pip>=26.2.2' \
    && python -m pip uninstall -y uv
