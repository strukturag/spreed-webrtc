# Spreed WebRTC server in minimal Docker (for production)
#
# This Dockerfile creates a container which builds Spreed WebRTC as piped in
# on stdin using another Docker container defined in `Dockerfile.build`.
#
# First create the builder image:
#
#   ```
#   docker build -t spreed-webrtc-builder -f Dockerfile.build .
#   ```
#
# Next run the builder container, piping its output into the creation of the
# runner container:
#
#   ```
#   docker run --rm spreed-webrtc-builder | docker build -t spreed-webrtc -f Dockerfile.run -
#   ```
#
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

FROM frolvlad/alpine-glibc:alpine-3.3_glibc-2.23
MAINTAINER Simon Eisenmann <simon@struktur.de>

ENV LANG=C.UTF-8

# Add dependencies.
RUN apk add --no-cache \
	openssl

# Add Spreed WebRTC as provided by Dockerfile.run.
COPY srv/ /srv

# Move around stuff from tarball to their expected locations.
RUN mv /srv/spreed-webrtc/dist/loader/* /srv/spreed-webrtc && \
	mv /srv/spreed-webrtc/dist/www/html /srv/spreed-webrtc && \
	mv /srv/spreed-webrtc/dist/www/static /srv/spreed-webrtc

# Add entrypoint.
COPY docker_entrypoint.sh /srv/entrypoint.sh

# Create default config.
RUN cp -v /srv/spreed-webrtc/server.conf.in /srv/spreed-webrtc/default.conf && \
	sed -i 's|listen = 127.0.0.1:8080|listen = 0.0.0.0:8080|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;root = .*|root = /srv/spreed-webrtc|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;listen = 127.0.0.1:8443|listen = 0.0.0.0:8443|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;certificate = .*|certificate = /srv/cert.pem|' /srv/spreed-webrtc/default.conf && \
	sed -i 's|;key = .*|key = /srv/privkey.pem|' /srv/spreed-webrtc/default.conf && \
	touch /etc/spreed-webrtc-server.conf

# Cleanup.
RUN rm -rf /tmp/* /var/cache/apk/*

# Add mount point for extra things.
RUN mkdir /srv/extra
VOLUME /srv/extra

# Tell about our service.
EXPOSE 8080
EXPOSE 8443

# Define entry point with default command.
ENTRYPOINT ["/bin/sh", "/srv/entrypoint.sh", "-dc", "/srv/spreed-webrtc/default.conf"]
CMD ["-c", "/etc/spreed-webrtc-server.conf"]
