#!/bin/sh
set -e

randomhex() {
	local size="$1"
	if [ -z "${size}" ]; then
		size=32
	fi
	local val=$(hexdump -e '4/4 "%08x"' -n${size} /dev/urandom)
	echo ${val}
}

if [ "$NEWCERT" = "1" -o ! -s /srv/cert.pem ]; then
	echo "Creating new self signed TLS certificate ..."
	rm -f /srv/privkey.pem
	rm -f /srv/cert.pem
	openssl ecparam -genkey -name secp384r1 -out /srv/privkey.pem
	openssl req -new -x509 -key /srv/privkey.pem \
				-out /srv/cert.pem -days 3650 \
				-subj /CN=spreed-webrtc \
				-config /etc/ssl/openssl.cnf \
				-sha256 -extensions v3_req

fi
echo "TLS certificate:"
openssl x509 -in /srv/cert.pem -text

if [ "$NEWSECRETS" = "1" -o ! -s /srv/secrets.conf ]; then
	echo "Creating new server secrets ..."
	rm -f /srv/secrets.conf.tmp
	echo "SESSION_SECRET=$(randomhex 32)" >>/srv/secrets.conf.tmp
	echo "ENCRYPTION_SECRET=$(randomhex 32)" >>/srv/secrets.conf.tmp
	echo "SERVER_TOKEN=$(randomhex 32)" >>/srv/secrets.conf.tmp
	echo "SHARED_SECRET=$(randomhex 32)" >>/srv/secrets.conf.tmp
	. /srv/secrets.conf.tmp
	sed -i -e "s/sessionSecret =.*/sessionSecret = $SESSION_SECRET/" /srv/spreed-webrtc/default.conf
	sed -i -e "s/encryptionSecret =.*/encryptionSecret = $ENCRYPTION_SECRET/" /srv/spreed-webrtc/default.conf
	sed -i -e "s/serverToken =.*/serverToken = $SERVER_TOKEN/" /srv/spreed-webrtc/default.conf
	sed -i -e "s/;sharedsecret_secret =.*/sharedsecret_secret = $SHARED_SECRET/" /srv/spreed-webrtc/default.conf
	mv /srv/secrets.conf.tmp /srv/secrets.conf
fi
echo "Server secrets:"
cat /srv/secrets.conf

echo "Staring Spreed WebRTC server ..."
exec /srv/spreed-webrtc/spreed-webrtc-server "$@"
