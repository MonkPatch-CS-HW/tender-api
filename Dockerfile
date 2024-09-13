FROM node:alpine3.19

EXPOSE 8080

RUN npm install -g pnpm

COPY package.json package.json

RUN pnpm install

COPY . .

RUN pnpm build

CMD prisma db push && pnpm start
