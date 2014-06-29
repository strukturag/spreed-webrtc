FROM ubuntu:trusty

# Base system
RUN apt-get update -q

# Base build dependencies.
RUN apt-get install -qy golang nodejs build-essential git mercurial automake autoconf

# Add and build Spreed WebRTC server.
ADD . /srv/spreed-webrtc 
WORKDIR /srv/spreed-webrtc
RUN ./autogen.sh
RUN ./configure
RUN make pristine && make

# Create default config file.
RUN cp -v /srv/spreed-webrtc/server.conf.in /srv/spreed-webrtc/server.conf
RUN sed -i 's|listen = 127.0.0.1:8080|listen = 0.0.0.0:8080|' /srv/spreed-webrtc/server.conf
RUN sed -i 's|sessionSecret = .*|sessionSecret = `openssl rand -hex 32`|' /srv/spreed-webrtc/server.conf
RUN sed -i 's|encryptionSecret = .*|encryptionSecret = `openssl rand -hex 16`|' /srv/spreed-webrtc/server.conf
RUN sed -i 's|;root = .*|root = /srv/spreed-webrtc|' /srv/spreed-webrtc/server.conf

# Allow to mount.
VOLUME /srv/spreed-webrtc

# Tell about our service.
EXPOSE 8080

# Define entry point.
ENTRYPOINT ["/srv/spreed-webrtc/spreed-webrtc-server", "-c /srv/spreed-webrtc/server.conf"]