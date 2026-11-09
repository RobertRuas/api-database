# MAP.md — Mapa da aplicação

> Ponto de partida obrigatório para o agente de IA.
> **Mantenha este arquivo sincronizado com o disco a cada alteração estrutural.**

Data da última revisão: `2026-11-09`

---

## Diretórios

| Caminho          | Propósito                                                                 |
|------------------|---------------------------------------------------------------------------|
| `/`              | Raiz do projeto. Configs, docs e metadados.                              |
| `/prisma/`       | Schema do banco e migrations geradas.                                     |
| `/src/`          | Código-fonte TypeScript da API.                                          |
| `/src/routes/`   | Handlers de rota agrupados por domínio.                                   |
| `/src/admin/`    | Assets estáticos do painel administrativo (HTML/CSS/JS).                 |
| `/storage/`      | **Runtime.** Raiz dos arquivos enviados. Nunca commitar conteúdo.         |
| `/deploy/`       | Artefatos de deploy (Nginx conf + guia operacional).                      |

## Arquivos raiz

| Arquivo          | O que faz                                                                 |
|------------------|---------------------------------------------------------------------------|
| `CLAUDE.md`      | Regras obrigatórias para o agente de IA. Lido antes de qualquer tarefa.  |
| `MAP.md`         | Este arquivo. Mapa de todos os diretórios e arquivos.                     |
| `README.md`      | Documentação pública: visão geral, instalação, uso, referência de API.   |
| `CHANGELOG.md`   | Histórico de mudanças relevantes para consumidores da API.                |
| `package.json`   | Manifesto Node. Dependências, scripts, metadata.                          |
| `tsconfig.json`  | Configuração do TypeScript (strict, ESM, NodeNext).                       |
| `.env.example`   | Modelo de variáveis de ambiente. Copie para `.env`.                       |
| `.gitignore`     | Padrões ignorados pelo Git.                                               |
| `.dockerignore`  | Padrões excluídos do build da imagem Docker.                              |
| `Dockerfile`     | Build multi-stage da imagem de produção (builder + runner enxuto).        |
| `docker-compose.yml` | Stack `postgres` + `api` para produção/dev.                            |

## `deploy/`

| Arquivo              | O que faz                                                            |
|----------------------|----------------------------------------------------------------------|
| `deploy/nginx.conf`  | Config Nginx reverse-proxy para `database.windlog.org` com TLS.      |
| `deploy/README.md`   | Passo a passo operacional de deploy, backup, restore e atualização.  |

## `prisma/`

| Arquivo                | O que faz                                                            |
|------------------------|----------------------------------------------------------------------|
| `prisma/schema.prisma` | Modelos: `Application`, `ApiKey`, `Collection`, `Document`, `DocumentVersion`, `FileAsset`, `AccessLog`, `Setting`. |

## `src/` — núcleo

| Arquivo              | Exporta                                     | Propósito                                                        |
|----------------------|---------------------------------------------|------------------------------------------------------------------|
| `src/server.ts`      | *(bootstrap)*                               | Monta o Fastify, registra plugins e rotas, inicia o servidor.   |
| `src/config.ts`      | `config` (objeto validado por Zod)          | Lê e valida `.env`. Falha cedo se algo faltar.                   |
| `src/db.ts`          | `prisma` (PrismaClient singleton)           | Instância única do Prisma com log de queries em dev.             |
| `src/logger.ts`      | `logger` (instância Pino)                    | Logger estruturado compartilhado.                                |
| `src/storage.ts`     | `saveFile`, `readFile`, `deleteFile`, `resolveStoredPath` | Abstração do filesystem. Caminhos previsíveis, hash sha256.      |
| `src/errors.ts`      | `AppError`, `errorHandler`                   | Erros tipados + handler global do Fastify.                       |
| `src/auth.ts`        | `apiKeyAuth`, `adminAuth`, `createApiKey`, `hashPassword`, `verifyPassword`, `getAdminPasswordHash`, `setAdminPasswordHash` | Middlewares de autenticação (API key e sessão admin) e utilitários. Password hash em `settings` sobrescreve `.env`. |
| `src/access-log.ts`  | `registerAccessLog`                          | Hook onResponse que grava cada request em `access_logs`.          |

## `src/routes/`

| Arquivo                    | Rotas registradas                                               |
|----------------------------|-----------------------------------------------------------------|
| `src/routes/landing.ts`    | `GET /` — landing page pública (status ao vivo).                |
| `src/routes/docs.ts`       | `GET /docs` — manual completo (tema branco, sidebar, exemplos). |
| `src/routes/health.ts`     | `GET /health` — status da API e do banco.                       |
| `src/routes/documents.ts`  | `POST /v1/:collection` · `GET /v1/:collection` · `GET /v1/:collection/:id` · `PATCH /v1/:collection/:id` · `PUT /v1/:collection/:id` · `DELETE /v1/:collection/:id` · `GET /v1/:collection/:id/versions` |
| `src/routes/files.ts`      | `POST /v1/files/:collection` · `GET /v1/files?collection=X` · `GET /v1/files/:id` · `DELETE /v1/files/:id` |
| `src/routes/admin.ts`      | `GET /admin` · login/logout · alterar senha · info do sistema · purgar logs · CRUD apps · CRUD chaves · stats por chave · requisições por app · navegar coleções/documentos/versões · criar/editar/excluir documentos · excluir coleção · download/excluir arquivos · stats globais e por aplicação |

## `src/admin/`

| Arquivo                   | O que faz                                                     |
|---------------------------|---------------------------------------------------------------|
| `src/admin/index.html`    | Painel SPA single-file: login, lista de apps, chaves, stats.  |

## `storage/` — runtime (não commitado)

Convenção de caminho dos arquivos salvos:

```
storage/<applicationId>/<collection>/<YYYY>/<MM>/<uuid><ext>
```

---

## Como atualizar este arquivo

- Novo arquivo? Adicione uma linha na tabela do diretório correspondente.
- Removeu? Apague a linha.
- Renomeou? Atualize o caminho.
- Nova rota? Adicione na tabela de `src/routes/`.
- Mudou o contrato público (export) de um módulo em `src/`? Atualize a coluna "Exporta".
