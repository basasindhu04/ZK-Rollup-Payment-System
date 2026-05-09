FROM node:20-alpine

# Install wget for healthcheck support
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code and migrations
COPY src/ ./src/
COPY migrations/ ./migrations/

# Build TypeScript
RUN npm run build

# Create deployments directory (will be mounted)
RUN mkdir -p /app/deployments

EXPOSE 4000

CMD ["node", "dist/index.js"]
