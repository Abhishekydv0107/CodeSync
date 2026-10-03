# Minimal, no-network sandbox for running untrusted JavaScript snippets.
FROM node:20-alpine

RUN adduser -D sandboxuser
USER sandboxuser
WORKDIR /home/sandboxuser

COPY --chown=sandboxuser:sandboxuser entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
