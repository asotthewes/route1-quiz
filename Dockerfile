FROM node:20-alpine
WORKDIR /app

# Kopieer alleen wat bestaat en installeer prod deps
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --only=production; \
    else \
      npm install --omit=dev; \
    fi

# App source
COPY src ./src
COPY views ./views
COPY public ./public
COPY .env.example ./

RUN mkdir -p /app/data
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "node src/seed.js && node src/server.js"]
