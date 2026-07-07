#!/bin/sh

until apk add --no-cache curl; do sleep 5; done

DOMAIN=$(echo "$gateway_HOST" | sed -e 's|^http://||' -e 's|^https://||' | awk -F/ '{print $1}' | awk -F: '{print $1}')
mkdir -p /webroot/.well-known/acme-challenge

if [ -n "$DOMAIN" ]; then
	echo ready > /webroot/.well-known/acme-challenge/probe
	tries=0
	until curl -fsS "http://chimera:$gateway_PORT/.well-known/acme-challenge/probe" 2>/dev/null | grep -q ready; do
		tries=$((tries+1))
		if [ "$tries" -ge 120 ]; then echo "gateway not serving /.well-known after ~10m; proceeding"; break; fi
		sleep 5
	done
fi

fails=0
while true; do
	if [ -n "$DOMAIN" ] && [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
		if certbot certonly --webroot -w /webroot -d "$DOMAIN" --register-unsafely-without-email --agree-tos --non-interactive; then
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
	sleep 43200
done
