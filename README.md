# API DataBase

> Uma API central, enxuta e universal para armazenar **coleções livres de dados JSON** e **arquivos** — pensada para servir múltiplas aplicações a partir de um único backend confiável.

[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)]()
[![License](https://img.shields.io/badge/license-MIT-lightgrey)]()

---

## Visão geral

`API DataBase` resolve um problema recorrente: você tem várias aplicações pequenas (configs, scripts, apps mobile, serviços internos) que precisam de um lugar simples para persistir dados estruturados e arquivos, **sem subir um banco por projeto**.

A proposta é ser um *"Firestore minimalista self-hosted"*:

- **Coleções livres** — nenhum schema obrigatório, insira JSON arbitrário.
- **Isolamento por aplicação** — cada API Key enxerga apenas seus dados.
- **Upload de arquivos** — organizados em disco, metadados no banco.
- **Histórico de versões** — toda alteração de documento vira uma versão imutável.
- **Painel administrativo** integrado — gerencie apps e chaves sem sair do navegador.
- **Enxuto** — Fastify, Prisma, PostgreSQL. Nada mais.

---

## Começando

### Pré-requisitos

- Node.js ≥ 20
- PostgreSQL 14+
- `pnpm` (recomendado) ou `npm`

### Instalação

```bash
git clone <repo> api-database
cd api-database
pnpm install                    # ou: npm install

cp .env.example .env            # preencha DATABASE_URL, SESSION_SECRET, ADMIN_*
pnpm db:migrate                 # cria as tabelas
pnpm dev                        # inicia em http://localhost:3000
```

Em produção:

```bash
pnpm build
pnpm db:deploy
pnpm start
```

---

## Autenticação

Toda requisição à API de dados precisa de uma **API Key** no header:

```
X-API-Key: apidb_live_abc123...
```

Chaves são geradas pelo painel em `/admin`. Cada chave:

- Pertence a **uma única aplicação** (isolamento total).
- Tem **escopos** (`read`, `write`, `delete`, `files`).
- É **mostrada apenas na criação** — o servidor só guarda o hash.

---

## Referência da API

Todas as respostas seguem o shape:

```json
{ "ok": true,  "data": ... }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### Health

```http
GET /health
```

Retorna `{ ok, uptime, db: "up" | "down", version }`. Não requer autenticação.

### Documentos

| Método  | Rota                            | Escopo    | Descrição                                        |
|---------|---------------------------------|-----------|--------------------------------------------------|
| `POST`  | `/v1/:collection`               | `write`   | Cria um documento. Coleção criada implicitamente.|
| `GET`   | `/v1/:collection`               | `read`    | Lista documentos. Query: `?limit=&offset=&q=`.   |
| `GET`   | `/v1/:collection/:id`           | `read`    | Lê um documento.                                 |
| `PATCH` | `/v1/:collection/:id`           | `write`   | Merge parcial no `data`. Cria nova versão.       |
| `PUT`   | `/v1/:collection/:id`           | `write`   | Substitui o `data` inteiro. Cria nova versão.    |
| `DELETE`| `/v1/:collection/:id`           | `delete`  | Soft-delete.                                     |
| `GET`   | `/v1/:collection/:id/versions`  | `read`    | Lista versões anteriores.                        |

**Exemplo — criar documento:**

```bash
curl -X POST https://database.windlog.org/v1/configs \
  -H "X-API-Key: apidb_live_..." \
  -H "Content-Type: application/json" \
  -d '{"theme": "dark", "locale": "pt-BR"}'
```

### Arquivos

| Método  | Rota                       | Escopo  | Descrição                            |
|---------|----------------------------|---------|--------------------------------------|
| `POST`  | `/v1/files/:collection`    | `files` | Upload multipart. Campo `file`.      |
| `GET`   | `/v1/files?collection=X`   | `files` | Lista arquivos da coleção.           |
| `GET`   | `/v1/files/:id`            | `files` | Download do arquivo (stream).        |
| `DELETE`| `/v1/files/:id`            | `files` | Apaga o arquivo (disco + metadata).  |

**Exemplo — upload:**

```bash
curl -X POST https://database.windlog.org/v1/files/backups \
  -H "X-API-Key: apidb_live_..." \
  -F "file=@./backup.tar.gz"
```

---

## Painel administrativo

Acesse `/admin`. Credenciais vêm das envs `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

Funções:

- Criar/listar/desativar aplicações.
- Gerar API keys com escopos.
- Visualizar uso (contagem de documentos, arquivos, tamanho ocupado).
- Revogar chaves comprometidas instantaneamente.

---

## Segurança

- Senhas de admin verificadas com **bcrypt** em memória.
- API keys armazenadas como **hash bcrypt** — o valor em claro só aparece na criação.
- **Helmet** para headers seguros.
- **Rate limit** configurável (default: 300 req/min por IP).
- Cookies de sessão `HttpOnly`, `SameSite=Lax`, `Secure` em produção.
- Isolamento por aplicação verificado em toda rota de dados.

---

## Estrutura

Veja [MAP.md](./MAP.md) — mapa completo de diretórios e arquivos, mantido sempre atualizado.

---

## Contribuindo

O projeto segue regras estritas descritas em [CLAUDE.md](./CLAUDE.md), inclusive para contribuidores humanos:

- Commits vão direto para `main` (sem branches).
- Padrão de commit: *Conventional Commits* (`feat:`, `fix:`, `docs:`, …).
- Mudanças que afetam o contrato público entram no [CHANGELOG.md](./CHANGELOG.md).

---

## Licença

MIT. Use à vontade.
