FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsup.config.ts tsconfig.json ./
COPY src ./src
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_ALLOWED_HOSTS=localhost,127.0.0.1
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD ["node", "-e", "const p=process.env.MCP_HTTP_PORT||'3000';fetch('http://127.0.0.1:'+p+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
USER node
CMD ["node", "dist/index.js", "--http"]
