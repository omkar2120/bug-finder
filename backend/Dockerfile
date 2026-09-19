FROM mcr.microsoft.com/playwright:v1.53.0-noble

WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY automation ./automation
COPY backend ./backend
RUN npm install --workspace=shared --workspace=automation --workspace=backend --include-workspace-root=false

WORKDIR /app
ENV NODE_ENV=production
CMD ["npm", "run", "dev", "-w", "backend"]
