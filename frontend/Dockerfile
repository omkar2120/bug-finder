FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY index.html ./
COPY public ./public
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js ./
RUN npm install && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
