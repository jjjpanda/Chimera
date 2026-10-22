FROM certbot/certbot:v5.8.0@sha256:f70ad0adbb7e117f0fe42a63c553f28ea451edabc0148757b6efcd9735acaa20

RUN apk add --no-cache curl 'ca-certificates>=20261020-r0' \
    && PIP_CERT=/etc/ssl/certs/ca-certificates.crt python -m pip install --no-cache-dir --upgrade 'certifi>=2026.10.19' 'pip>=26.2.2' \
    && python -m pip uninstall -y uv
