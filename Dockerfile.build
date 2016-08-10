# Spreed WebRTC server Docker builder
#
# This Dockerfile creates a container which builds Spreed WebRTC as found in the
# current folder, and creates a tarball which can be piped into another Docker
# container for creating minimal sized Docker containers.
#
# First create the builder image:
#
#   ```
#   docker build -t spreed-webrtc-builder -f Dockerfile.build .
#   ```
# Next run the builder container, piping its output into the creation of the
# runner container. This creates a minimal size Docker image which can be used
# to run Spreed WebRTC in production.
#
#   ```
#   docker run --rm spreed-webrtc-builder | docker build -t spreed-webrtc -f Dockerfile.run -
#   ```

FROM ubuntu:xenial
MAINTAINER Simon Eisenmann <simon@struktur.de>

# Set locale.
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
RUN mkdir -p /usr/share/gocode/src
RUN ./autogen.sh && \
	./configure && \
	make pristine && \
	make get && \
	make tarball
RUN rm /srv/spreed-webrtc/dist_*/*.tar.gz
RUN mv /srv/spreed-webrtc/dist_*/spreed-webrtc-* /srv/spreed-webrtc/dist

# Add gear required by Dockerfile.run.
COPY Dockerfile.run /
COPY scripts/docker_entrypoint.sh /

# Running this image produces a tarball suitable to be piped into another
# Docker build command.
CMD tar -cf - -C / Dockerfile.run docker_entrypoint.sh /srv/spreed-webrtc/dist
