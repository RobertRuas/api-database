# ============================================================
#  API DataBase — Imagem de produção multi-stage.
#  - Stage builder: instala tudo e compila TypeScript + gera Prisma client.
#  - Stage runner: imagem enxuta só com o necessário para rodar.
# ============================================================

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Dependências de sistema que o Prisma e algumas libs precisam.
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Gera o client do Prisma e compila TS → JS.
RUN npx prisma generate
RUN npm run build

# Remove devDependencies para copiar só o necessário para o runner.
RUN npm prune --omit=dev

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl libc6-compat tini \
 && addgroup -S app && adduser -S app -G app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# O painel precisa dos assets HTML junto do bundle.
COPY --from=builder /app/src/admin ./dist/admin

RUN mkdir -p /app/storage && chown -R app:app /app
USER app

EXPOSE 3000
# Tini garante que SIGTERM chega ao processo Node.
ENTRYPOINT ["/sbin/tini", "--"]

# Sincroniza o schema no banco (primeiro deploy). Para ambientes maduros,
# substitua por `prisma migrate deploy` com migrations versionadas.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/server.js"]
