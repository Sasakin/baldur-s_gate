# Dockerfile
FROM node:24-slim

# Install pnpm
RUN npm config set strict-ssl false && npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy pnpm configuration and workspace definition
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy all packages' package.json files for better caching
# This assumes you have the following structure:
COPY artifacts/baldurs-gate/package.json ./artifacts/baldurs-gate/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY scripts/package.json ./scripts/

# Install dependencies
RUN npm config set strict-ssl false && pnpm install

# Copy the rest of the application code
COPY . .

# Expose the port from server.ts
EXPOSE 3000

# Set environment to development by default
ENV NODE_ENV=development

# Start the application
CMD ["pnpm", "run", "dev"]
