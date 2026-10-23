# Syntax: Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies including build tools
RUN npm install

# Copy application source
COPY . .

# Build production assets (Vite client to dist/)
RUN npm run build

# --- Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy dependency files and install production-only dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend assets and required server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose default port (overridden by Cloud Run / Render / Railway via $PORT)
EXPOSE 3000

# Start unified Sentinel Express server
CMD ["npm", "start"]
