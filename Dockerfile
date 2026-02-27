FROM node:22-alpine

WORKDIR /app

# Install server deps
COPY package.json package-lock.json ./
RUN npm ci --production

# Install client deps and build
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Copy server
COPY server/ ./server/

ENV PORT=9092
ENV NODE_ENV=production
EXPOSE 9092

CMD ["node", "server/index.js"]
# Fri Feb 27 20:03:30 UTC 2026
