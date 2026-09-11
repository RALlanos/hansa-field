FROM node:24-alpine

WORKDIR /app

ARG API_INTERNAL_URL=http://api:3100

ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_INTERNAL_URL=$API_INTERNAL_URL

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @hansa-field/web build

EXPOSE 3200

CMD ["pnpm", "--filter", "@hansa-field/web", "start"]
