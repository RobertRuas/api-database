# CLAUDE.md — Regras do Agente para este projeto

> **Leia este arquivo e o [MAP.md](./MAP.md) ANTES de qualquer tarefa.**
> Eles substituem a necessidade de ler o código inteiro toda vez.

---

## 1. Fluxo de trabalho obrigatório

1. **Consulte primeiro o [MAP.md](./MAP.md)** para localizar o que precisa alterar.
2. Leia apenas os arquivos relevantes (nunca um sweep inteiro).
3. Faça a alteração objetiva e mínima para atender ao pedido.
4. **Atualize o [MAP.md](./MAP.md)** imediatamente após criar, renomear, mover ou apagar qualquer arquivo/diretório, ou se alterar o que uma função expõe publicamente.
5. Faça um commit na `main` (veja regras de Git abaixo).

## 2. Regras de Git — inegociáveis

- **NUNCA criar branches novos.** Todo commit vai direto para `main`.
- **NUNCA fazer `--amend` em commits já publicados.**
- **NUNCA usar `--no-verify`** para pular hooks.
- **NUNCA usar `--force` push em `main`.**
- Mensagens de commit seguem o padrão *Conventional Commits*:
  `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `chore: ...`, `test: ...`.
- Commits pequenos e focados — uma unidade lógica por commit.
- **PR notes / release notes:** quando a mudança for relevante para quem usa a API (nova rota, mudança de contrato, mudança de env), adicione uma linha em `CHANGELOG.md` sob `## [Unreleased]`.

## 3. Princípios de engenharia

- **Enxuto > Esperto.** Não introduzir abstrações, feature flags, ou camadas "para o futuro".
- **Falhe cedo, falhe claro.** Toda rota passa por validação Zod. Erros sobem para o handler global.
- **Nunca confiar em entrada.** Usuário, arquivo, header — tudo validado nas bordas.
- **Segurança por padrão.** Helmet, rate-limit, cookies HTTP-only, senhas em bcrypt, API keys hasheadas.
- **Zero `any` sem motivo documentado** no TypeScript.
- **Sem código morto.** Se não é usado agora, não entra.
- **Comentários didáticos, não extensos.** Um comentário explica *por quê*, não *o quê*. Cabeçalho curto por arquivo quando o propósito não é óbvio.

## 4. Convenções de código

- Módulos ESM (`import ... from`).
- Funções pequenas (~40 linhas). Se passar disso, extraia.
- Nomes em português para domínio de negócio (coleção, aplicação, chave) e em inglês para termos técnicos (handler, middleware, schema).
- Erros customizados em [src/errors.ts](./src/errors.ts) — nunca jogue `throw "string"`.
- Logs estruturados via `pino` — sem `console.log`.
- Toda rota retorna JSON com o shape padrão:
  - Sucesso: `{ "ok": true, "data": ... }`
  - Erro:    `{ "ok": false, "error": { "code": "...", "message": "..." } }`

## 5. Antes de dar uma tarefa por concluída

- [ ] `pnpm lint` (ou `npm run lint`) passa — zero erros de tipo.
- [ ] MAP.md reflete a realidade do disco.
- [ ] Nenhum segredo commitado.
- [ ] Rotas novas documentadas no README.md.
- [ ] Commit feito na `main` com mensagem Conventional.

## 6. O que NÃO fazer

- **Proibido usar emojis em qualquer lugar** — código, HTML, strings, logs, comentários, commits, docs, README, mensagens ao usuário, favicon. Use ícones SVG profissionais (Lucide, Heroicons ou equivalentes inline) quando precisar de um símbolo visual. Nenhum caractere pictórico Unicode (U+1F000–U+1FFFF, U+2600–U+27BF e afins).
- Criar documentação paralela (planning.md, notes.md). Use este arquivo e o MAP.
- Instalar dependência sem necessidade clara — toda dep é débito técnico.
- Fazer refatoração "de carona" numa correção de bug.
- Alterar contratos de API sem incrementar a versão no `package.json` e registrar no `CHANGELOG.md`.
- Esconder erros com `try/catch` vazio. Loggue ou propague.

## 7. Health check e observabilidade

- Toda release precisa manter `GET /health` funcional retornando `{ ok: true, uptime, db: "up" }`.
- Logs vão para `stdout` em JSON — orquestradores (systemd, Docker, PM2) coletam.
