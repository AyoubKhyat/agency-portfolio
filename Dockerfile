# syntax=docker/dockerfile:1
# Self-hosted image. NEXT_PUBLIC_* values are baked in at build time (pass them as build args).
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_EMAILJS_SERVICE_ID
ARG NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
ARG NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No database is needed to build: public pages and the sitemap are rendered per request.
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 app && mkdir -p /data/uploads && chown -R app /data
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
# Blog MDX files are read from disk at runtime.
COPY --from=build --chown=app /app/content ./content
USER app
EXPOSE 3000
CMD ["node", "server.js"]
