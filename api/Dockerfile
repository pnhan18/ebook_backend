# Sử dụng Node.js phiên bản LTS làm base image
FROM node:22-alpine AS base

# Cài đặt dependencies cần thiết cho Alpine Linux
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Stage 1: Dependencies
FROM base AS deps
# Cài đặt dependencies (bao gồm cả devDependencies cho build)
RUN npm ci && npm cache clean --force

# Stage 2: Build
FROM base AS build
# Copy dependencies từ stage deps
COPY --from=deps /app/node_modules ./node_modules
# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build ứng dụng NestJS
RUN npm run build

# Stage 3: Production dependencies
FROM base AS prod-deps
# Cài đặt chỉ production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 4: Runtime
FROM node:22-alpine AS runtime

# Tạo user không phải root để chạy ứng dụng
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Set working directory
WORKDIR /app

# Copy built application từ build stage
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package*.json ./

# Chuyển sang user nestjs
USER nestjs

# Expose port (thường là 3000 cho NestJS)
EXPOSE 3000

# Copy prisma schema and generate client
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Khởi động ứng dụng
CMD ["node", "dist/main"]