FROM ghcr.io/puppeteer/puppeteer:22.12.0

USER root

# Add user so we don't need --no-sandbox.
RUN mkdir -p /home/pptruser/Downloads /app/public  \
    && touch /app/index.html /app/public/index.html \
    && chown pptruser:pptruser /app/index.html /app/public/index.html \
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

CMD ["/usr/local/bin/node", "/app/index.js"]