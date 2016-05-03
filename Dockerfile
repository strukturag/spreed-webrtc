# Spreed WebRTC server.
#
# To execute it install docker and then run 'sudo docker build .'
#
FROM ubuntu:xenial
MAINTAINER Simon Eisenmann <simon@struktur.de>

# Set locale.
RUN locale-gen --no-purge en_US.UTF-8
ENV LC_ALL en_US.UTF-8

ENV DEBIAN_FRONTEND noninteractive

# Base system
RUN apt-get update -q

# Base build dependencies.
RUN apt-get install -qy golang nodejs build-essential git mercurial automake autoconf

# Add and build Spreed WebRTC server.
ADD . /srv/spreed-webrtc
WORKDIR /srv/spreed-webrtc
RUN ./autogen.sh
RUN ./configure
RUN make pristine && make get && make

# Create default config file.
RUN cp -v /srv/spreed-webrtc/server.conf.in /srv/spreed-webrtc/server.conf && \
	sed -i 's|listen = 127.0.0.1:8080|listen = 0.0.0.0:8080|' /srv/spreed-webrtc/server.conf && \
	sed -i 's|;root = .*|root = /srv/spreed-webrtc|' /srv/spreed-webrtc/server.conf

# Allow to mount.
VOLUME /srv/spreed-webrtc

# Tell about our service.
EXPOSE 8080

# Define entry point.
ENTRYPOINT ["/srv/spreed-webrtc/spreed-webrtc-server", "-c /srv/spreed-webrtc/server.conf"]