# Frontend Dockerfile (Debian-based to avoid SWC/musl issues)
FROM node:20 AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app .
EXPOSE 3000
CMD ["npm", "run", "start"]

# Optional production runner (not used by compose dev). To use, set proper CMD to `npm run start` and ensure build succeeded.
# FROM node:20-alpine AS prod
# WORKDIR /app
# ENV NODE_ENV=production
# COPY --from=builder /app .
# EXPOSE 3000
# CMD ["npm", "run", "start"]
