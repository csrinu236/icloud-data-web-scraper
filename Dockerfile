FROM ghcr.io/puppeteer/puppeteer:22.12.0

USER root

# Add user so we don't need --no-sandbox.
RUN mkdir -p /home/pptruser/Downloads /app/public \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app 

# RUN mkdir -p /home/pptruser/Downloads /app/public \
# && chown -R pptruser:pptruser /home/pptruser \
# && chown -R pptruser:pptruser /app

# Run everything after as non-privileged user.
USER pptruser

ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium
        
COPY package.json /app/
RUN cd /app/ && npm install
COPY index.js /app/
COPY utils.js /app/
COPY public /app/public
COPY build /app/build


# EXPOSE 80
# EXPOSE 443
EXPOSE 3300
EXPOSE 3400

CMD ["/usr/local/bin/node", "/app/index.js"]