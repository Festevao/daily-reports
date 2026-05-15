FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY . .

RUN pnpm consumer:build

ENV NODE_ENV=production

CMD ["node", "dist/run-consumer.js"]