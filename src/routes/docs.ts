/**
 * routes/docs.ts — Manual de instruções em `/docs`.
 *
 * Página estática servida inline, estilo "documentação técnica", tema branco.
 * Mesma linha visual da landing — monoespaçado, sóbrio, sem dependências.
 */
import type { FastifyPluginAsync } from 'fastify';

const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Manual — api-database</title>
  <meta name="description" content="Manual completo da API DataBase." />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'/%3E%3C/svg%3E" />
  <style>
    :root {
      --bg: #fff; --fg: #0a0a0a; --muted: #6b7280; --line: #e5e7eb;
      --accent: #0a0a0a; --code: #f6f8fa; --code-fg: #0a0a0a;
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: var(--bg); color: var(--fg); -webkit-font-smoothing: antialiased; }
    body {
      font: 15px/1.7 -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
    }
    .wrap { display: grid; grid-template-columns: 240px minmax(0,1fr); max-width: 1120px; margin: 0 auto; gap: 48px; padding: 0 24px; }
    @media (max-width: 860px) {
      .wrap { grid-template-columns: 1fr; gap: 0; }
      aside { display: none; }
    }

    header.top {
      border-bottom: 1px solid var(--line);
      position: sticky; top: 0; background: rgba(255,255,255,0.92);
      backdrop-filter: blur(6px); z-index: 10;
    }
    header.top > div {
      max-width: 1120px; margin: 0 auto; padding: 16px 24px;
      display: flex; justify-content: space-between; align-items: center;
    }
    header.top h1 { font-size: 15px; font-weight: 600; margin: 0; font-family: var(--mono); }
    header.top h1::before { content: "> "; color: var(--muted); }
    header.top nav a { color: var(--muted); text-decoration: none; margin-left: 16px; font-size: 13px; }
    header.top nav a:hover { color: var(--fg); }

    aside {
      padding-top: 40px; position: sticky; top: 64px; align-self: start;
      max-height: calc(100vh - 80px); overflow-y: auto;
    }
    aside .section { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 8px; }
    aside .section:first-child { margin-top: 0; }
    aside a {
      display: block; color: var(--fg); text-decoration: none;
      padding: 4px 10px; border-radius: 4px; font-size: 13px; margin: 1px 0;
      border-left: 2px solid transparent;
    }
    aside a:hover { background: var(--code); }
    aside a.active { border-left-color: var(--fg); font-weight: 500; }

    main { padding: 40px 0 80px; min-width: 0; }
    h2 { font-size: 24px; letter-spacing: -0.4px; margin: 56px 0 8px; scroll-margin-top: 72px; }
    h2:first-child { margin-top: 0; }
    h2::before { content: "## "; color: var(--muted); font-weight: 400; }
    h3 { font-size: 17px; margin: 32px 0 8px; scroll-margin-top: 72px; }
    h3::before { content: "### "; color: var(--muted); font-weight: 400; }
    p { color: #1f2937; margin: 8px 0 16px; }
    .lead { color: var(--muted); font-size: 16px; }
    code {
      font-family: var(--mono); font-size: 0.92em;
      background: var(--code); padding: 1px 6px; border-radius: 4px;
    }
    pre {
      background: var(--code); border: 1px solid var(--line);
      border-radius: 6px; padding: 16px 18px; overflow-x: auto;
      font-size: 13px; line-height: 1.6; margin: 0 0 20px;
    }
    pre code { background: transparent; padding: 0; font-size: inherit; }
    .cmt { color: var(--muted); }
    .str { color: #116329; }
    .kw { color: #cf222e; }
    .num { color: #0550ae; }

    table { width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: 14px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    td code { font-size: 12.5px; }

    .m { display: inline-block; font: 600 11px/1 var(--mono); padding: 3px 7px; border-radius: 4px; letter-spacing: 0.5px; }
    .m.get    { background: #dbeafe; color: #1e40af; }
    .m.post   { background: #dcfce7; color: #166534; }
    .m.patch  { background: #fef3c7; color: #92400e; }
    .m.put    { background: #ede9fe; color: #5b21b6; }
    .m.delete { background: #fee2e2; color: #991b1b; }

    .callout {
      border-left: 3px solid var(--fg); background: #fafafa;
      padding: 12px 16px; margin: 16px 0 24px; font-size: 14px;
      border-radius: 0 4px 4px 0;
    }
    .callout strong { font-weight: 600; }

    .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); margin-bottom: -1px; flex-wrap: wrap; }
    .tabs button {
      font: 500 12px var(--mono); background: transparent; border: none;
      padding: 7px 10px; cursor: pointer; color: var(--muted);
      border-bottom: 2px solid transparent; white-space: nowrap;
    }
    .tabs button:hover { color: var(--fg); }
    .tabs button.on { color: var(--fg); border-bottom-color: var(--fg); }
    .tab-panel { display: none; }
    .tab-panel.on { display: block; }

    footer {
      margin: 80px 0 40px; padding-top: 24px; border-top: 1px solid var(--line);
      color: var(--muted); font-size: 13px; display: flex; justify-content: space-between;
    }
    footer a { color: var(--muted); }
  </style>
</head>
<body>
  <header class="top">
    <div>
      <h1>api-database / manual</h1>
      <nav>
        <a href="/">↗ status</a>
        <a href="/admin">↗ painel</a>
        <a href="/health">↗ /health</a>
      </nav>
    </div>
  </header>

  <div class="wrap">
    <aside>
      <div class="section">Introdução</div>
      <a href="#visao-geral">Visão geral</a>
      <a href="#conceitos">Conceitos</a>
      <a href="#primeiros-passos">Primeiros passos</a>

      <div class="section">Autenticação</div>
      <a href="#api-keys">API Keys</a>
      <a href="#escopos">Escopos</a>

      <div class="section">Documentos</div>
      <a href="#criar-documento">Criar</a>
      <a href="#ler-listar">Ler e listar</a>
      <a href="#atualizar">Atualizar</a>
      <a href="#deletar">Deletar</a>
      <a href="#versoes">Versões</a>

      <div class="section">Arquivos</div>
      <a href="#upload">Upload</a>
      <a href="#download">Download</a>
      <a href="#listar-arquivos">Listar</a>

      <div class="section">Referência</div>
      <a href="#respostas">Respostas</a>
      <a href="#erros">Códigos de erro</a>
      <a href="#limites">Limites</a>
      <a href="#sdks">Exemplos por linguagem</a>
    </aside>

    <main>
      <h2 id="visao-geral">Visão geral</h2>
      <p class="lead">
        <strong>api-database</strong> é um backend universal para armazenar coleções livres de dados JSON e arquivos.
        Pense como um "Firestore self-hosted minimalista": você aponta sua aplicação para
        <code>https://api.windlog.org</code>, usa uma API Key, e tem persistência estruturada sem subir banco próprio.
      </p>
      <div class="callout">
        <strong>Para quem é isso?</strong> Scripts pessoais, apps pequenos, dashboards, backups de config,
        protótipos — qualquer caso onde você precisa de um lugar simples e confiável para gravar dados e arquivos.
      </div>

      <h2 id="conceitos">Conceitos</h2>
      <table>
        <tr><th>Termo</th><th>Significado</th></tr>
        <tr><td><strong>Aplicação</strong></td><td>Unidade de isolamento. Criada no painel. Cada aplicação enxerga apenas seus próprios dados.</td></tr>
        <tr><td><strong>API Key</strong></td><td>Credencial vinculada a uma aplicação. Tem escopos (read/write/delete/files). Só aparece em claro na criação.</td></tr>
        <tr><td><strong>Coleção</strong></td><td>Agrupamento lógico de documentos (ex.: <code>configs</code>, <code>users</code>, <code>logs</code>). Criada automaticamente no primeiro insert.</td></tr>
        <tr><td><strong>Documento</strong></td><td>Um objeto JSON arbitrário dentro de uma coleção. Tem <code>id</code>, <code>data</code>, <code>version</code>.</td></tr>
        <tr><td><strong>Versão</strong></td><td>Toda alteração (PATCH/PUT) grava uma versão imutável no histórico.</td></tr>
        <tr><td><strong>Arquivo</strong></td><td>Binário salvo em disco, organizado por aplicação/coleção/data. Metadata (nome, tipo, sha256) fica no banco.</td></tr>
      </table>

      <h2 id="primeiros-passos">Primeiros passos</h2>
      <p>Três passos para começar:</p>
      <ol>
        <li>Acesse o <a href="/admin">painel</a> e crie uma <strong>Aplicação</strong>.</li>
        <li>Dentro da aplicação, gere uma <strong>API Key</strong> com os escopos que precisa. <em>Copie o token — ele só aparece uma vez.</em></li>
        <li>Faça sua primeira requisição:</li>
      </ol>
      <pre><code><span class="cmt"># criar um documento numa coleção chamada "configs"</span>
<span class="kw">curl</span> -X POST https://api.windlog.org/v1/configs \\
  -H <span class="str">"X-API-Key: apidb_live_SEU_TOKEN"</span> \\
  -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"theme":"dark","locale":"pt-BR","version":<span class="num">3</span>}'</span></code></pre>

      <h2 id="api-keys">API Keys</h2>
      <p>Toda requisição à API de dados precisa de uma chave. Envie em um destes headers:</p>
      <pre><code>X-API-Key: apidb_live_abc123...
<span class="cmt"># ou (compatível com clientes HTTP padrão):</span>
Authorization: Bearer apidb_live_abc123...</code></pre>

      <h3 id="escopos">Escopos</h3>
      <table>
        <tr><th>Escopo</th><th>Permite</th></tr>
        <tr><td><code>read</code></td><td>GET de documentos e versões</td></tr>
        <tr><td><code>write</code></td><td>POST/PATCH/PUT em documentos</td></tr>
        <tr><td><code>delete</code></td><td>DELETE de documentos (soft)</td></tr>
        <tr><td><code>files</code></td><td>Upload/download/listagem de arquivos (combine com <code>delete</code> para apagar)</td></tr>
      </table>

      <h2 id="criar-documento">Criar documento</h2>
      <p><span class="m post">POST</span> <code>/v1/:collection</code> · escopo <code>write</code></p>
      <p>A coleção é criada automaticamente na primeira chamada. O body é um objeto JSON qualquer.</p>
      <pre><code><span class="kw">curl</span> -X POST https://api.windlog.org/v1/configs \\
  -H <span class="str">"X-API-Key: ..."</span> -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"theme":"dark","locale":"pt-BR"}'</span>

<span class="cmt"># Resposta</span>
{
  <span class="str">"ok"</span>: true,
  <span class="str">"data"</span>: {
    <span class="str">"id"</span>: <span class="str">"clx1a2b3c..."</span>,
    <span class="str">"data"</span>: { <span class="str">"theme"</span>: <span class="str">"dark"</span>, <span class="str">"locale"</span>: <span class="str">"pt-BR"</span> },
    <span class="str">"version"</span>: <span class="num">1</span>,
    <span class="str">"createdAt"</span>: <span class="str">"2026-11-09T20:00:00.000Z"</span>,
    <span class="str">"updatedAt"</span>: <span class="str">"2026-11-09T20:00:00.000Z"</span>
  }
}</code></pre>

      <h2 id="ler-listar">Ler e listar</h2>
      <p><span class="m get">GET</span> <code>/v1/:collection/:id</code> — lê um único documento.</p>
      <p><span class="m get">GET</span> <code>/v1/:collection?limit=50&amp;offset=0</code> — lista com paginação.</p>
      <pre><code><span class="kw">curl</span> -H <span class="str">"X-API-Key: ..."</span> \\
  https://api.windlog.org/v1/configs?limit=10

<span class="cmt"># Resposta</span>
{ <span class="str">"ok"</span>: true, <span class="str">"data"</span>: { <span class="str">"items"</span>: [...], <span class="str">"total"</span>: <span class="num">42</span>, <span class="str">"limit"</span>: <span class="num">10</span>, <span class="str">"offset"</span>: <span class="num">0</span> } }</code></pre>

      <h2 id="atualizar">Atualizar</h2>
      <p><span class="m patch">PATCH</span> faz <em>merge profundo</em> no objeto <code>data</code>.</p>
      <p><span class="m put">PUT</span> <em>substitui</em> o objeto inteiro.</p>
      <p>Ambos incrementam <code>version</code> e gravam uma linha em <code>document_versions</code>.</p>
      <pre><code><span class="cmt"># merge — mantém campos não citados</span>
<span class="kw">curl</span> -X PATCH https://api.windlog.org/v1/configs/clx1a2b3c... \\
  -H <span class="str">"X-API-Key: ..."</span> -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"theme":"light"}'</span>

<span class="cmt"># substituição total</span>
<span class="kw">curl</span> -X PUT https://api.windlog.org/v1/configs/clx1a2b3c... \\
  -H <span class="str">"X-API-Key: ..."</span> -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"theme":"light","locale":"en-US"}'</span></code></pre>

      <h2 id="deletar">Deletar</h2>
      <p><span class="m delete">DELETE</span> <code>/v1/:collection/:id</code> — soft delete (marca <code>deletedAt</code>; versões permanecem).</p>

      <h2 id="versoes">Histórico de versões</h2>
      <p><span class="m get">GET</span> <code>/v1/:collection/:id/versions</code> — retorna a timeline completa, da mais nova para a mais antiga.</p>

      <h2 id="upload">Upload de arquivo</h2>
      <p><span class="m post">POST</span> <code>/v1/files/:collection</code> · escopo <code>files</code> · <code>multipart/form-data</code>, campo <code>file</code>.</p>
      <pre><code><span class="kw">curl</span> -X POST https://api.windlog.org/v1/files/backups \\
  -H <span class="str">"X-API-Key: ..."</span> \\
  -F <span class="str">"file=@./backup-2026-11-09.tar.gz"</span>

<span class="cmt"># Resposta</span>
{
  <span class="str">"ok"</span>: true,
  <span class="str">"data"</span>: {
    <span class="str">"id"</span>: <span class="str">"clx..."</span>,
    <span class="str">"collection"</span>: <span class="str">"backups"</span>,
    <span class="str">"originalName"</span>: <span class="str">"backup-2026-11-09.tar.gz"</span>,
    <span class="str">"size"</span>: <span class="num">10485760</span>,
    <span class="str">"mimeType"</span>: <span class="str">"application/gzip"</span>,
    <span class="str">"sha256"</span>: <span class="str">"a3f2..."</span>
  }
}</code></pre>
      <div class="callout">
        Tamanho máximo padrão: <strong>300 MB</strong> por arquivo. Ajustável via <code>MAX_FILE_SIZE</code> no servidor.
      </div>

      <h2 id="download">Download</h2>
      <p><span class="m get">GET</span> <code>/v1/files/:id</code> — retorna o binário com <code>Content-Disposition: attachment</code>.</p>
      <pre><code><span class="kw">curl</span> -H <span class="str">"X-API-Key: ..."</span> \\
  -o backup.tar.gz \\
  https://api.windlog.org/v1/files/clx...</code></pre>

      <h2 id="listar-arquivos">Listar arquivos</h2>
      <p><span class="m get">GET</span> <code>/v1/files?collection=X&amp;limit=50</code></p>

      <h2 id="respostas">Formato de resposta</h2>
      <p>Todo endpoint retorna o mesmo envelope:</p>
      <pre><code><span class="cmt">// sucesso</span>
{ <span class="str">"ok"</span>: true, <span class="str">"data"</span>: ... }

<span class="cmt">// erro</span>
{ <span class="str">"ok"</span>: false, <span class="str">"error"</span>: { <span class="str">"code"</span>: <span class="str">"..."</span>, <span class="str">"message"</span>: <span class="str">"..."</span>, <span class="str">"details"</span>?: ... } }</code></pre>

      <h2 id="erros">Códigos de erro</h2>
      <table>
        <tr><th>HTTP</th><th>Code</th><th>Quando</th></tr>
        <tr><td>400</td><td><code>VALIDATION_ERROR</code></td><td>Payload ou params inválidos (Zod detalha em <code>details</code>).</td></tr>
        <tr><td>400</td><td><code>BAD_REQUEST</code></td><td>Erro genérico de entrada.</td></tr>
        <tr><td>401</td><td><code>UNAUTHORIZED</code></td><td>API key ausente, inválida ou revogada.</td></tr>
        <tr><td>403</td><td><code>FORBIDDEN</code></td><td>Escopo insuficiente, aplicação desativada.</td></tr>
        <tr><td>404</td><td><code>NOT_FOUND</code></td><td>Recurso inexistente ou de outra aplicação.</td></tr>
        <tr><td>409</td><td><code>CONFLICT</code></td><td>Nome duplicado ou estado conflitante.</td></tr>
        <tr><td>413</td><td><code>PAYLOAD_TOO_LARGE</code></td><td>Arquivo acima do limite.</td></tr>
        <tr><td>429</td><td><code>RATE_LIMITED</code></td><td>Excedeu o rate limit (300 req/min padrão).</td></tr>
        <tr><td>500</td><td><code>INTERNAL_ERROR</code></td><td>Falha inesperada no servidor (logada).</td></tr>
      </table>

      <h2 id="limites">Limites</h2>
      <table>
        <tr><td>Rate limit</td><td>300 req/min por IP</td></tr>
        <tr><td>Tamanho máximo de arquivo</td><td>100 MB</td></tr>
        <tr><td>Tamanho máximo de JSON</td><td>~10 MB</td></tr>
        <tr><td>Paginação máxima</td><td>200 itens</td></tr>
        <tr><td>Nome de coleção</td><td>1–64 chars, <code>[A-Za-z0-9_-]</code></td></tr>
      </table>

      <h2 id="sdks">Exemplos por linguagem</h2>
      <div class="tabs" id="tabs">
        <button data-tab="js" class="on">JS / Node</button>
        <button data-tab="browser">Browser</button>
        <button data-tab="ts">TypeScript</button>
        <button data-tab="py">Python</button>
        <button data-tab="php">PHP</button>
        <button data-tab="go">Go</button>
        <button data-tab="rb">Ruby</button>
        <button data-tab="java">Java</button>
        <button data-tab="cs">C# / .NET</button>
        <button data-tab="rust">Rust</button>
        <button data-tab="sh">cURL</button>
      </div>

      <div class="tab-panel on" data-panel="js">
<pre><code><span class="kw">const</span> API = <span class="str">"https://api.windlog.org"</span>;
<span class="kw">const</span> KEY = process.env.APIDB_KEY;

<span class="kw">async function</span> set(collection, data) {
  <span class="kw">const</span> r = <span class="kw">await</span> fetch(<span class="str">\`\${API}/v1/\${collection}\`</span>, {
    method: <span class="str">"POST"</span>,
    headers: {
      <span class="str">"X-API-Key"</span>: KEY,
      <span class="str">"Content-Type"</span>: <span class="str">"application/json"</span>,
    },
    body: JSON.stringify(data),
  });
  <span class="kw">const</span> json = <span class="kw">await</span> r.json();
  <span class="kw">if</span> (!json.ok) <span class="kw">throw new</span> Error(json.error.message);
  <span class="kw">return</span> json.data;
}

<span class="kw">const</span> doc = <span class="kw">await</span> set(<span class="str">"configs"</span>, { theme: <span class="str">"dark"</span> });
console.log(doc.id);</code></pre>
      </div>

      <div class="tab-panel" data-panel="browser">
<pre><code><span class="cmt">// Em navegadores — use com uma chave de uso restrito.</span>
<span class="cmt">// Nunca coloque uma chave com escopo "delete" em frontend público.</span>
<span class="kw">const</span> API = <span class="str">"https://api.windlog.org"</span>;
<span class="kw">const</span> KEY = <span class="str">"apidb_live_..."</span>;

<span class="kw">async function</span> getDoc(collection, id) {
  <span class="kw">const</span> res = <span class="kw">await</span> fetch(<span class="str">\`\${API}/v1/\${collection}/\${id}\`</span>, {
    headers: { <span class="str">"X-API-Key"</span>: KEY },
  });
  <span class="kw">if</span> (!res.ok) <span class="kw">throw new</span> Error(<span class="str">\`HTTP \${res.status}\`</span>);
  <span class="kw">const</span> { data } = <span class="kw">await</span> res.json();
  <span class="kw">return</span> data;
}

<span class="cmt">// Upload com &lt;input type="file"&gt;</span>
<span class="kw">async function</span> uploadFile(collection, file) {
  <span class="kw">const</span> fd = <span class="kw">new</span> FormData();
  fd.append(<span class="str">"file"</span>, file);
  <span class="kw">const</span> res = <span class="kw">await</span> fetch(<span class="str">\`\${API}/v1/files/\${collection}\`</span>, {
    method: <span class="str">"POST"</span>,
    headers: { <span class="str">"X-API-Key"</span>: KEY },
    body: fd,
  });
  <span class="kw">return</span> (<span class="kw">await</span> res.json()).data;
}</code></pre>
      </div>

      <div class="tab-panel" data-panel="ts">
<pre><code><span class="cmt">// Mini-SDK tipado para TypeScript / Deno / Bun.</span>
<span class="kw">interface</span> Envelope&lt;T&gt; { ok: <span class="kw">boolean</span>; data?: T; error?: { code: <span class="kw">string</span>; message: <span class="kw">string</span> }; }
<span class="kw">interface</span> Doc&lt;T = <span class="kw">unknown</span>&gt; { id: <span class="kw">string</span>; data: T; version: <span class="kw">number</span>; updatedAt: <span class="kw">string</span>; }

<span class="kw">export class</span> ApiDatabase {
  <span class="kw">constructor</span>(<span class="kw">private</span> baseUrl: <span class="kw">string</span>, <span class="kw">private</span> key: <span class="kw">string</span>) {}

  <span class="kw">private async</span> req&lt;T&gt;(path: <span class="kw">string</span>, init: RequestInit = {}): Promise&lt;T&gt; {
    <span class="kw">const</span> r = <span class="kw">await</span> fetch(<span class="str">\`\${</span><span class="kw">this</span>.baseUrl<span class="str">}\${path}\`</span>, {
      ...init,
      headers: { <span class="str">"X-API-Key"</span>: <span class="kw">this</span>.key, <span class="str">"Content-Type"</span>: <span class="str">"application/json"</span>, ...init.headers },
    });
    <span class="kw">const</span> body = <span class="kw">await</span> r.json() <span class="kw">as</span> Envelope&lt;T&gt;;
    <span class="kw">if</span> (!body.ok) <span class="kw">throw new</span> Error(body.error?.message ?? <span class="str">\`HTTP \${r.status}\`</span>);
    <span class="kw">return</span> body.data!;
  }

  create&lt;T&gt;(col: <span class="kw">string</span>, data: T) { <span class="kw">return</span> <span class="kw">this</span>.req&lt;Doc&lt;T&gt;&gt;(<span class="str">\`/v1/\${col}\`</span>, { method: <span class="str">"POST"</span>, body: JSON.stringify(data) }); }
  get&lt;T&gt;(col: <span class="kw">string</span>, id: <span class="kw">string</span>) { <span class="kw">return</span> <span class="kw">this</span>.req&lt;Doc&lt;T&gt;&gt;(<span class="str">\`/v1/\${col}/\${id}\`</span>); }
  patch&lt;T&gt;(col: <span class="kw">string</span>, id: <span class="kw">string</span>, patch: Partial&lt;T&gt;) { <span class="kw">return</span> <span class="kw">this</span>.req&lt;Doc&lt;T&gt;&gt;(<span class="str">\`/v1/\${col}/\${id}\`</span>, { method: <span class="str">"PATCH"</span>, body: JSON.stringify(patch) }); }
  del(col: <span class="kw">string</span>, id: <span class="kw">string</span>) { <span class="kw">return</span> <span class="kw">this</span>.req&lt;{ id: <span class="kw">string</span>; deleted: <span class="kw">boolean</span> }&gt;(<span class="str">\`/v1/\${col}/\${id}\`</span>, { method: <span class="str">"DELETE"</span> }); }
}

<span class="kw">const</span> db = <span class="kw">new</span> ApiDatabase(<span class="str">"https://api.windlog.org"</span>, process.env.APIDB_KEY!);
<span class="kw">const</span> doc = <span class="kw">await</span> db.create(<span class="str">"configs"</span>, { theme: <span class="str">"dark"</span> });</code></pre>
      </div>

      <div class="tab-panel" data-panel="py">
<pre><code><span class="kw">import</span> os, requests

API = <span class="str">"https://api.windlog.org"</span>
KEY = os.environ[<span class="str">"APIDB_KEY"</span>]
S = requests.Session()
S.headers.update({<span class="str">"X-API-Key"</span>: KEY})

<span class="kw">def</span> call(method, path, **kw):
    r = S.request(method, <span class="str">f"{API}{path}"</span>, timeout=15, **kw)
    r.raise_for_status()
    body = r.json()
    <span class="kw">if not</span> body[<span class="str">"ok"</span>]:
        <span class="kw">raise</span> RuntimeError(body[<span class="str">"error"</span>][<span class="str">"message"</span>])
    <span class="kw">return</span> body[<span class="str">"data"</span>]

<span class="cmt"># CRUD</span>
doc = call(<span class="str">"POST"</span>, <span class="str">"/v1/configs"</span>, json={<span class="str">"theme"</span>: <span class="str">"dark"</span>})
doc = call(<span class="str">"PATCH"</span>, <span class="str">f"/v1/configs/{doc['id']}"</span>, json={<span class="str">"locale"</span>: <span class="str">"pt-BR"</span>})
all_ = call(<span class="str">"GET"</span>, <span class="str">"/v1/configs"</span>)[<span class="str">"items"</span>]

<span class="cmt"># Upload</span>
<span class="kw">with</span> open(<span class="str">"dump.sql.gz"</span>, <span class="str">"rb"</span>) <span class="kw">as</span> f:
    file = call(<span class="str">"POST"</span>, <span class="str">"/v1/files/backups"</span>, files={<span class="str">"file"</span>: f})
<span class="kw">print</span>(file[<span class="str">"id"</span>])</code></pre>
      </div>

      <div class="tab-panel" data-panel="php">
<pre><code><span class="kw">&lt;?php</span>
<span class="kw">const</span> API_URL = <span class="str">'https://api.windlog.org'</span>;
<span class="kw">const</span> API_KEY = <span class="str">'apidb_live_...'</span>;

<span class="kw">function</span> apidb(<span class="kw">string</span> $method, <span class="kw">string</span> $path, ?array $data = <span class="kw">null</span>): array {
    $ch = curl_init(API_URL . $path);
    $headers = [<span class="str">'X-API-Key: '</span> . API_KEY];
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  =&gt; $method,
        CURLOPT_RETURNTRANSFER =&gt; <span class="kw">true</span>,
        CURLOPT_TIMEOUT        =&gt; 15,
    ]);
    <span class="kw">if</span> ($data !== <span class="kw">null</span>) {
        $headers[] = <span class="str">'Content-Type: application/json'</span>;
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $body = json_decode(curl_exec($ch), <span class="kw">true</span>);
    curl_close($ch);
    <span class="kw">if</span> (empty($body[<span class="str">'ok'</span>])) <span class="kw">throw new</span> RuntimeException($body[<span class="str">'error'</span>][<span class="str">'message'</span>] ?? <span class="str">'erro'</span>);
    <span class="kw">return</span> $body[<span class="str">'data'</span>];
}

$doc = apidb(<span class="str">'POST'</span>, <span class="str">'/v1/configs'</span>, [<span class="str">'theme'</span> =&gt; <span class="str">'dark'</span>]);
<span class="kw">echo</span> $doc[<span class="str">'id'</span>];</code></pre>
      </div>

      <div class="tab-panel" data-panel="go">
<pre><code><span class="kw">package</span> main

<span class="kw">import</span> (
    <span class="str">"bytes"</span>
    <span class="str">"encoding/json"</span>
    <span class="str">"errors"</span>
    <span class="str">"net/http"</span>
    <span class="str">"os"</span>
)

<span class="kw">const</span> apiURL = <span class="str">"https://api.windlog.org"</span>

<span class="kw">type</span> envelope <span class="kw">struct</span> {
    OK    <span class="kw">bool</span>            <span class="str">\`json:"ok"\`</span>
    Data  json.RawMessage <span class="str">\`json:"data"\`</span>
    Error <span class="kw">struct</span>{ Message <span class="kw">string</span> <span class="str">\`json:"message"\`</span> } <span class="str">\`json:"error"\`</span>
}

<span class="kw">func</span> call(method, path <span class="kw">string</span>, body <span class="kw">any</span>) (json.RawMessage, <span class="kw">error</span>) {
    <span class="kw">var</span> buf *bytes.Buffer
    <span class="kw">if</span> body != <span class="kw">nil</span> {
        b, _ := json.Marshal(body)
        buf = bytes.NewBuffer(b)
    } <span class="kw">else</span> { buf = &amp;bytes.Buffer{} }
    req, _ := http.NewRequest(method, apiURL+path, buf)
    req.Header.Set(<span class="str">"X-API-Key"</span>, os.Getenv(<span class="str">"APIDB_KEY"</span>))
    req.Header.Set(<span class="str">"Content-Type"</span>, <span class="str">"application/json"</span>)
    res, err := http.DefaultClient.Do(req)
    <span class="kw">if</span> err != <span class="kw">nil</span> { <span class="kw">return</span> <span class="kw">nil</span>, err }
    <span class="kw">defer</span> res.Body.Close()
    <span class="kw">var</span> env envelope
    <span class="kw">if</span> err := json.NewDecoder(res.Body).Decode(&amp;env); err != <span class="kw">nil</span> { <span class="kw">return</span> <span class="kw">nil</span>, err }
    <span class="kw">if</span> !env.OK { <span class="kw">return</span> <span class="kw">nil</span>, errors.New(env.Error.Message) }
    <span class="kw">return</span> env.Data, <span class="kw">nil</span>
}

<span class="kw">func</span> main() {
    data, err := call(<span class="str">"POST"</span>, <span class="str">"/v1/configs"</span>, <span class="kw">map</span>[<span class="kw">string</span>]<span class="kw">any</span>{<span class="str">"theme"</span>: <span class="str">"dark"</span>})
    <span class="kw">if</span> err != <span class="kw">nil</span> { <span class="kw">panic</span>(err) }
    println(<span class="kw">string</span>(data))
}</code></pre>
      </div>

      <div class="tab-panel" data-panel="rb">
<pre><code><span class="kw">require</span> <span class="str">'net/http'</span>
<span class="kw">require</span> <span class="str">'json'</span>

API = URI(<span class="str">'https://api.windlog.org'</span>)
KEY = ENV.fetch(<span class="str">'APIDB_KEY'</span>)

<span class="kw">def</span> apidb(method, path, body = <span class="kw">nil</span>)
  uri = URI.join(API, path)
  req = <span class="kw">case</span> method
        <span class="kw">when</span> <span class="str">:get</span>    <span class="kw">then</span> Net::HTTP::Get.new(uri)
        <span class="kw">when</span> <span class="str">:post</span>   <span class="kw">then</span> Net::HTTP::Post.new(uri)
        <span class="kw">when</span> <span class="str">:patch</span>  <span class="kw">then</span> Net::HTTP::Patch.new(uri)
        <span class="kw">when</span> <span class="str">:delete</span> <span class="kw">then</span> Net::HTTP::Delete.new(uri)
        <span class="kw">end</span>
  req[<span class="str">'X-API-Key'</span>] = KEY
  req[<span class="str">'Content-Type'</span>] = <span class="str">'application/json'</span>
  req.body = body.to_json <span class="kw">if</span> body
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: <span class="kw">true</span>) { |h| h.request(req) }
  json = JSON.parse(res.body)
  <span class="kw">raise</span> json.dig(<span class="str">'error'</span>, <span class="str">'message'</span>) <span class="kw">unless</span> json[<span class="str">'ok'</span>]
  json[<span class="str">'data'</span>]
<span class="kw">end</span>

doc = apidb(<span class="str">:post</span>, <span class="str">'/v1/configs'</span>, theme: <span class="str">'dark'</span>)
puts doc[<span class="str">'id'</span>]</code></pre>
      </div>

      <div class="tab-panel" data-panel="java">
<pre><code><span class="kw">import</span> java.net.URI;
<span class="kw">import</span> java.net.http.*;

<span class="kw">public class</span> ApiDatabase {
    <span class="kw">static final</span> String API = <span class="str">"https://api.windlog.org"</span>;
    <span class="kw">static final</span> String KEY = System.getenv(<span class="str">"APIDB_KEY"</span>);
    <span class="kw">static final</span> HttpClient CLIENT = HttpClient.newHttpClient();

    <span class="kw">static</span> String call(String method, String path, String body) <span class="kw">throws</span> Exception {
        HttpRequest.BodyPublisher pub = body == <span class="kw">null</span>
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
        HttpRequest req = HttpRequest.newBuilder(URI.create(API + path))
            .method(method, pub)
            .header(<span class="str">"X-API-Key"</span>, KEY)
            .header(<span class="str">"Content-Type"</span>, <span class="str">"application/json"</span>)
            .build();
        HttpResponse&lt;String&gt; res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
        <span class="kw">if</span> (res.statusCode() &gt;= 400) <span class="kw">throw new</span> RuntimeException(res.body());
        <span class="kw">return</span> res.body();
    }

    <span class="kw">public static void</span> main(String[] args) <span class="kw">throws</span> Exception {
        System.out.println(call(<span class="str">"POST"</span>, <span class="str">"/v1/configs"</span>, <span class="str">"{\\"theme\\":\\"dark\\"}"</span>));
    }
}</code></pre>
      </div>

      <div class="tab-panel" data-panel="cs">
<pre><code><span class="kw">using</span> System.Net.Http.Json;

<span class="kw">var</span> http = <span class="kw">new</span> HttpClient { BaseAddress = <span class="kw">new</span>(<span class="str">"https://api.windlog.org/"</span>) };
http.DefaultRequestHeaders.Add(<span class="str">"X-API-Key"</span>, Environment.GetEnvironmentVariable(<span class="str">"APIDB_KEY"</span>));

<span class="kw">record</span> Envelope&lt;T&gt;(<span class="kw">bool</span> ok, T? data, ErrorBody? error);
<span class="kw">record</span> ErrorBody(<span class="kw">string</span> code, <span class="kw">string</span> message);

<span class="kw">async</span> Task&lt;T&gt; Call&lt;T&gt;(HttpMethod m, <span class="kw">string</span> path, <span class="kw">object</span>? body = <span class="kw">null</span>) {
    <span class="kw">var</span> req = <span class="kw">new</span> HttpRequestMessage(m, path);
    <span class="kw">if</span> (body != <span class="kw">null</span>) req.Content = JsonContent.Create(body);
    <span class="kw">var</span> res = <span class="kw">await</span> http.SendAsync(req);
    <span class="kw">var</span> env = <span class="kw">await</span> res.Content.ReadFromJsonAsync&lt;Envelope&lt;T&gt;&gt;();
    <span class="kw">if</span> (env is { ok: <span class="kw">true</span>, data: <span class="kw">var</span> d }) <span class="kw">return</span> d!;
    <span class="kw">throw new</span> Exception(env?.error?.message ?? <span class="str">"erro"</span>);
}

<span class="kw">var</span> doc = <span class="kw">await</span> Call&lt;<span class="kw">dynamic</span>&gt;(HttpMethod.Post, <span class="str">"v1/configs"</span>, <span class="kw">new</span> { theme = <span class="str">"dark"</span> });
Console.WriteLine(doc.id);</code></pre>
      </div>

      <div class="tab-panel" data-panel="rust">
<pre><code><span class="cmt">// Cargo.toml: reqwest = { version = "0.12", features = ["json"] }, tokio = { version = "1", features = ["full"] }, serde_json = "1"</span>
<span class="kw">use</span> serde_json::{json, Value};

<span class="kw">const</span> API: &amp;<span class="kw">str</span> = <span class="str">"https://api.windlog.org"</span>;

<span class="kw">async fn</span> call(method: reqwest::Method, path: &amp;<span class="kw">str</span>, body: Option&lt;Value&gt;) -&gt; <span class="kw">anyhow</span>::Result&lt;Value&gt; {
    <span class="kw">let</span> key = std::env::var(<span class="str">"APIDB_KEY"</span>)?;
    <span class="kw">let</span> client = reqwest::Client::new();
    <span class="kw">let mut</span> req = client.request(method, <span class="kw">format!</span>(<span class="str">"{API}{path}"</span>))
        .header(<span class="str">"X-API-Key"</span>, key);
    <span class="kw">if let</span> Some(b) = body { req = req.json(&amp;b); }
    <span class="kw">let</span> env: Value = req.send().<span class="kw">await</span>?.json().<span class="kw">await</span>?;
    <span class="kw">if</span> env[<span class="str">"ok"</span>].as_bool() != Some(<span class="kw">true</span>) {
        <span class="kw">anyhow::bail!</span>(<span class="str">"{}"</span>, env[<span class="str">"error"</span>][<span class="str">"message"</span>]);
    }
    Ok(env[<span class="str">"data"</span>].clone())
}

<span class="kw">#[tokio::main]</span>
<span class="kw">async fn</span> main() -&gt; <span class="kw">anyhow</span>::Result&lt;()&gt; {
    <span class="kw">let</span> doc = call(reqwest::Method::POST, <span class="str">"/v1/configs"</span>, Some(json!({<span class="str">"theme"</span>: <span class="str">"dark"</span>}))).<span class="kw">await</span>?;
    <span class="kw">println!</span>(<span class="str">"{}"</span>, doc[<span class="str">"id"</span>]);
    Ok(())
}</code></pre>
      </div>

      <div class="tab-panel" data-panel="sh">
<pre><code><span class="cmt"># variável de ambiente</span>
<span class="kw">export</span> APIDB_KEY=<span class="str">"apidb_live_..."</span>

<span class="cmt"># criar</span>
<span class="kw">curl</span> -X POST https://api.windlog.org/v1/configs \\
  -H <span class="str">"X-API-Key: $APIDB_KEY"</span> \\
  -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"theme":"dark"}'</span>

<span class="cmt"># ler</span>
<span class="kw">curl</span> -H <span class="str">"X-API-Key: $APIDB_KEY"</span> \\
  https://api.windlog.org/v1/configs

<span class="cmt"># atualizar (merge parcial)</span>
<span class="kw">curl</span> -X PATCH https://api.windlog.org/v1/configs/DOC_ID \\
  -H <span class="str">"X-API-Key: $APIDB_KEY"</span> -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"locale":"pt-BR"}'</span>

<span class="cmt"># upload</span>
<span class="kw">curl</span> -X POST https://api.windlog.org/v1/files/backups \\
  -H <span class="str">"X-API-Key: $APIDB_KEY"</span> \\
  -F <span class="str">"file=@./dump.sql.gz"</span>

<span class="cmt"># download</span>
<span class="kw">curl</span> -H <span class="str">"X-API-Key: $APIDB_KEY"</span> \\
  -o dump.sql.gz \\
  https://api.windlog.org/v1/files/FILE_ID</code></pre>
      </div>

      <footer>
        <span>© api.windlog.org — manual v1</span>
        <span><a href="/">status</a> · <a href="/admin">painel</a></span>
      </footer>
    </main>
  </div>

  <script>
    // Tabs
    const tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(t => t.onclick = () => {
      tabs.forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('on', p.dataset.panel === t.dataset.tab);
      });
    });
    // Realce do link ativo na sidebar
    const links = Array.from(document.querySelectorAll('aside a'));
    const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const spy = () => {
      const y = window.scrollY + 100;
      let active = sections[0];
      for (const s of sections) if (s.offsetTop <= y) active = s;
      links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + active.id));
    };
    window.addEventListener('scroll', spy, { passive: true }); spy();
  </script>
</body>
</html>`;

const docs: FastifyPluginAsync = async (app) => {
  app.get('/docs', async (_req, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8').send(HTML);
  });
};

export default docs;
