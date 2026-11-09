# Changelog

Mudanças relevantes para consumidores da API.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/) e [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Estrutura inicial do projeto: Fastify + Prisma + PostgreSQL.
- Rotas `v1` de documentos (CRUD + histórico de versões).
- Rotas `v1` de arquivos (upload/download/listagem).
- Painel administrativo em `/admin` com login por sessão.
- Autenticação por API Key com escopos (`read`, `write`, `delete`, `files`).
- Health check em `/health`.
- Rate limit, Helmet, CORS e logs estruturados com Pino.
