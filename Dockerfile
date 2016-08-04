# Spreed WebRTC server in Docker
#
# This Dockerfile creates a container which runs Spreed WebRTC as found in the
# current folder. It is intended for development.
#
# Install docker and then run `docker build -t spreed-webrtc .` to build the
# image. Afterwards run the container like this:
#
#   ```
#   docker run --rm --name my-spreed-webrtc -p 8080:8080 -p 8443:8443 \
#       -v `pwd`:/srv/extra -i -t spreed-webrtc
#   ```
#
# Now you can either use a frontend proxy like Nginx to provide TLS to Spreed
# WebRTC and even run it in production like that from the Docker container, or
# for easy development testing, the container also provides a TLS listener with
# a self-signed certificate on port 8443.
#
# To use custom configuration, use the `server.conf.in` file as template and
# remove the listeners from [http] and [https] sections. Then provide that file
# when running the docker container as with `-c` parameter like this:
#
#   ```
#   docker run --rm --name my-spreed-webrtc -p 8080:8080 \
#       -v `pwd`:/srv/extra -i -t spreed-webrtc` \
#       -c /srv/extra/server.conf
#   ```
#
# And last, this container checks environment variables NEWCERT and NEWSECRETS,
# on startup. Set those to `1` to regenerate the corresponding values on start.
# The current certificate and secrets are printed before startup so you can use
# them easily for other services. Of course, if you want to have persistent cert
# and secrets, the container needs to be persistent in the first place, so no
# `--rm` parameter in the example from above in that case.
#

FROM ubuntu:xenial
MAINTAINER Simon Eisenmann <simon@struktur.de>

# Set locale.
RUN locale-gen --no-purge en_US.UTF-8
ENV LC_ALL en_US.UTF-8

ENV DEBIAN_FRONTEND noninteractive

# Base build dependencies.
RUN apt-get update && apt-get install -qy \
	golang nodejs build-essential git automake autoconf

# Add and build Spreed WebRTC server.
ADD . /srv/spreed-webrtc
WORKDIR /srv/spreed-webrtc
RUN ./autogen.sh && ./configure && make pristine && make get && make

# Create entrypoint script.
RUN echo '\n\
set -e\n\
if [ "$NEWCERT" = "1" -o ! -e /srv/cert.pem ]; then\n\
	echo "Creating new self signed TLS certificate ..."\n\
	rm -f /srv/privkey.pem\n\
	rm -f /srv/cert.pem\n\
	openssl ecparam -genkey -name secp384r1 -out /srv/privkey.pem\n\
	openssl req -new -x509 -key /srv/privkey.pem \\\n\
				-out /srv/cert.pem -days 3650 \\\n\
				-subj /CN=spreed-webrtc \\\n\
				-config /etc/ssl/openssl.cnf \\\n\
				-sha256 -extensions v3_req\n\

fi\n\
echo "TLS certificate:"\n\
openssl x509 -in /srv/cert.pem -text\n\
if [ "$NEWSECRETS" = "1" -o ! -e /srv/secrets.conf ]; then\n\
	echo "Creating new server secrets ..."\n\
	rm -f /srv/secrets.conf.tmp\n\
	echo "SESSION_SECRET=$(openssl rand -hex 32)" >>/srv/secrets.conf.tmp\n\
	echo "ENCRYPTION_SECRET=$(openssl rand -hex 32)" >>/srv/secrets.conf.tmp\n\
	echo "SERVER_TOKEN=$(openssl rand -hex 32)" >>/srv/secrets.conf.tmp\n\
	echo "SHARED_SECRET=$(openssl rand -hex 32)" >>/srv/secrets.conf.tmp\n\
	. /srv/secrets.conf.tmp\n\
	sed -i -e "s/sessionSecret =.*/sessionSecret = $SESSION_SECRET/" /srv/spreed-webrtc/default.conf\n\
	sed -i -e "s/encryptionSecret =.*/encryptionSecret = $ENCRYPTION_SECRET/" /srv/spreed-webrtc/default.conf\n\
	sed -i -e "s/serverToken =.*/serverToken = $SERVER_TOKEN/" /srv/spreed-webrtc/default.conf\n\
	sed -i -e "s/;sharedsecret_secret =.*/sharedsecret_secret = $SHARED_SECRET/" /srv/spreed-webrtc/default.conf\n\
	mv /srv/secrets.conf.tmp /srv/secrets.conf\n\
fi\n\
echo "Server secrets:"\n\
cat /srv/secrets.conf\n\
echo "Staring Spreed WebRTC server ..."\n\
exec /srv/spreed-webrtc/spreed-webrtc-server "$@"\n'\
>> /srv/entrypoint.sh

# Create default config file.
RUN cp -v /srv/spreed-webrtc/server.conf.in /srv/spreed-webrtc/default.conf && \
	sed -i 's|listen = 127.0.0.1:8080|listen = 0.0.0.0:8080|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;root = .*|root = /srv/spreed-webrtc|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;listen = 127.0.0.1:8443|listen = 0.0.0.0:8443|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;certificate = .*|certificate = /srv/cert.pem|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;key = .*|key = /srv/privkey.pem|' /srv/spreed-webrtc/default.conf
RUN touch /srv/spreed-webrtc/server.conf

# Add mount point for extra things.
RUN mkdir /srv/extra
VOLUME /srv/extra

# Tell about our service.
EXPOSE 8080
EXPOSE 8443

# Define entry point with default command.
ENTRYPOINT ["/bin/sh", "/srv/entrypoint.sh", "-dc", "/srv/spreed-webrtc/default.conf"]
CMD ["-c", "/srv/spreed-webrtc/server.conf"]
