FROM certbot/certbot:v5.10.0@sha256:c5698da859429ccee0fcc299a8000368198222d1f9e789ab6e388b491e8ce06d

RUN apk add --no-cache curl 'ca-certificates>=20261020-r0' \
    && PIP_CERT=/etc/ssl/certs/ca-certificates.crt python -m pip install --no-cache-dir --upgrade 'certifi>=2026.10.19' 'pip>=26.2.2' \
    && python -m pip uninstall -y uv
