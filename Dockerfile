# Spreed WebRTC server in Docker (for development)
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
#   docker run --rm --name my-spreed-webrtc -p 8080:8080 -p 8443:8443 \
#       -v `pwd`:/srv/extra -i -t spreed-webrtc \
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
RUN apt-get clean && apt-get update
RUN apt-get install locales
RUN locale-gen --no-purge en_US.UTF-8
ENV LC_ALL en_US.UTF-8

ENV DEBIAN_FRONTEND noninteractive

# Base build dependencies.
RUN apt-get update && apt-get install -qy \
	golang \
	nodejs \
	build-essential \
	git \
	automake \
	autoconf

# Add and build Spreed WebRTC server.
ADD . /srv/spreed-webrtc
WORKDIR /srv/spreed-webrtc
RUN ./autogen.sh && \
	./configure && \
	make pristine && \
	make get && \
	make

# Add runtime dependencies.
RUN apt-get update && apt-get install -qy \
	bsdmainutils \
	openssl

# Add entrypoint.
COPY scripts/docker_entrypoint.sh /srv/entrypoint.sh

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
