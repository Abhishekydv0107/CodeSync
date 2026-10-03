# Minimal, no-network sandbox for running untrusted Python snippets.
FROM python:3.12-alpine

# Run as a non-root user so even a container escape bug has fewer privileges to abuse.
RUN adduser -D sandboxuser
USER sandboxuser
WORKDIR /home/sandboxuser

COPY --chown=sandboxuser:sandboxuser entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
