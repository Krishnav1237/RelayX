FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY scripts/ ./scripts/
EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/index.js"]
