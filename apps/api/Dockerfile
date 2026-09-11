FROM node:24-alpine

WORKDIR /app

ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @hansa-field/api build

EXPOSE 3100

CMD ["pnpm", "--filter", "@hansa-field/api", "start"]
