# Use Node 20 as required by latest Expo SDKs
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (leverage Docker cache)
COPY package*.json ./
RUN npm ci --silent || npm install --silent

# Copy project files
COPY . .

# FIX: Use 'npx expo export' without the deprecated '--output-dir' flag
# Modern Expo versions export to the 'dist' folder by default
RUN npx expo export -p web

# Production Stage (Example using Nginx to serve the web build)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
