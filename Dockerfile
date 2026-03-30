# syntax=docker/dockerfile:1

# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:22-alpine AS builder

# Enable corepack so we can use pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# vite will auto-pick up .env.production during build
RUN pnpm run build

# ── Stage 2: Serve with Nginx ────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx site
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy the built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
