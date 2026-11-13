# Changelog

Mudanças relevantes para consumidores da API.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/) e [SemVer](https://semver.org/).

## [Unreleased]

### Changed
- Limite padrão de upload de arquivo elevado de 100 MB para 300 MB (`MAX_FILE_SIZE`).
- Removida a quota de armazenamento por aplicação (`Application.storageQuotaBytes`).
- `DELETE /v1/files/:id` agora remove o blob do disco de forma síncrona antes
  de marcar o registro como deletado. Falha de FS propaga como 500 e nada é
  alterado, permitindo retry seguro.

### Added
- Estrutura inicial do projeto: Fastify + Prisma + PostgreSQL.
- Rotas `v1` de documentos (CRUD + histórico de versões).
- Rotas `v1` de arquivos (upload/download/listagem).
- Painel administrativo em `/admin` com login por sessão.
- Autenticação por API Key com escopos (`read`, `write`, `delete`, `files`).
- Health check em `/health`.
- Rate limit, Helmet, CORS e logs estruturados com Pino.
