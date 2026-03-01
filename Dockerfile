# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build:web

# Production stage
FROM nginx:stable-alpine AS production
COPY --from=build /app/web-build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
# Dockerfile to build and serve the Expo web build
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --silent || npm install --silent
COPY . .
RUN npm run build:web

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve --silent
COPY --from=build /app/web-build ./web-build
EXPOSE 3000
CMD ["serve", "-s", "web-build", "-l", "3000"]
