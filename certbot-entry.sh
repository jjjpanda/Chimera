#!/bin/sh

[ "$certbot_ON" = "true" ] || { echo "certbot disabled (certbot_ON!=true)"; exec tail -f /dev/null; }

DOMAIN=$(echo "$gateway_HOST" | sed -e 's|^http://||' -e 's|^https://||' | awk -F/ '{print $1}' | awk -F: '{print $1}')
mkdir -p /webroot/.well-known/acme-challenge

grant_gateway_read() {
	chgrp -R 1000 /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
	chmod -R g+rX /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
}

if [ -n "$DOMAIN" ]; then
	echo ready > /webroot/.well-known/acme-challenge/probe
	tries=0
	until curl -fsS "http://$DOMAIN/.well-known/acme-challenge/probe" 2>/dev/null | grep -q ready; do
		tries=$((tries+1))
		if [ "$tries" -ge 120 ]; then echo "$DOMAIN:80/.well-known not reachable after ~10m; proceeding"; break; fi
		sleep 5
	done
fi

fails=0
while true; do
	if [ -n "$DOMAIN" ] && [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
		if certbot certonly --webroot -w /webroot -d "$DOMAIN" --register-unsafely-without-email --agree-tos --non-interactive; then
			grant_gateway_read
			fails=0
		else
			fails=$((fails+1))
			if [ "$fails" -lt 3 ]; then sleep 300; continue; fi
			if [ "$fails" -lt 5 ]; then sleep 3600; continue; fi
			curl -fsS -X POST -H "Content-Type: application/json" -d "{\"content\": \"⚠️ certbot issuance failed for $DOMAIN after repeated retries\"}" "$alert_URL"
			fails=0
			sleep 43200
			continue
		fi
	fi

	certbot renew --webroot -w /webroot --quiet ||
		curl -fsS -X POST -H "Content-Type: application/json" -d "{\"content\": \"⚠️ certbot renew failed on $(hostname)\"}" "$alert_URL"
	grant_gateway_read
	sleep 43200
done
