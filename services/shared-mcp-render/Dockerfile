FROM node:22-alpine
WORKDIR /app
COPY services/shared-mcp-render/package.json ./package.json
COPY services/shared-mcp-render/server.js ./server.js
COPY mcp-worker/protocol.js ./protocol.js
ENV NODE_ENV=production
EXPOSE 10000
USER node
CMD ["node", "server.js"]
