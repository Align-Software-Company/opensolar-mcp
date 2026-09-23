FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsup.config.ts tsconfig.json ./
COPY src ./src
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24-bookworm-slim
LABEL org.opencontainers.image.title="OpenSolar MCP" \
      org.opencontainers.image.description="Unofficial, self-hosted MCP server for the documented OpenSolar API." \
      org.opencontainers.image.source="https://github.com/Align-Software-Company/opensolar-mcp" \
      org.opencontainers.image.licenses="MIT" \
      io.modelcontextprotocol.server.name="io.github.align-software-company/opensolar-mcp"
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
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
