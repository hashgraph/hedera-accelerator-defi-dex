FROM node:16-alpine
COPY . /app
WORKDIR /app
RUN npm config set strict-ssl false --global
RUN npm ci --only=production && npm cache clean --force
COPY $PWD/entrypoint.sh /usr/local/bin
ENTRYPOINT ["/bin/sh", "/usr/local/bin/entrypoint.sh"]