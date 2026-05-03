FROM node:20-slim

WORKDIR /app

# Install all dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

# Copy runtime files
COPY scripts/ ./scripts/

EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/index.js"]
