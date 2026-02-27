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

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server/index.js"]
