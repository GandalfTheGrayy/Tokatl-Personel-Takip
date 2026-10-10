FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl postgresql-client fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["sh","-c","npx prisma db push --skip-generate && node prisma/seed.js && node src/index.js"]
