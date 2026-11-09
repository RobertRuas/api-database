/**
 * routes/landing.ts — Landing page pública em `/`.
 *
 * Página estática servida inline — sem dependência de FS no runtime.
 * Faz uma chamada client-side a /health para exibir status ao vivo.
 */
import type { FastifyPluginAsync } from 'fastify';

const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API DataBase</title>
  <meta name="description" content="API central de coleções e arquivos — minimalista, universal." />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🗃️%3C/text%3E%3C/svg%3E" />
  <style>
    :root {
      --bg: #ffffff;
      --fg: #0a0a0a;
      --muted: #6b7280;
      --line: #e5e7eb;
      --accent: #10b981;
      --accent-bg: #ecfdf5;
      --danger: #ef4444;
      --danger-bg: #fef2f2;
      --code-bg: #f6f8fa;
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
    body {
      font-family: var(--mono);
      font-size: 14px; line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    main { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }

    header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 40px; }
    header h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
    header h1::before { content: "> "; color: var(--muted); }
    header .ver { color: var(--muted); font-size: 12px; }

    .section { margin: 32px 0; }
    .section-title {
      color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
      margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
    }
    .section-title::before { content: "##"; color: var(--line); }

    .status-card {
      border: 1px solid var(--line); border-radius: 6px;
      padding: 18px 20px;
      display: flex; align-items: center; justify-content: space-between;
      background: var(--bg);
    }
    .status-left { display: flex; align-items: center; gap: 14px; }
    .dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--muted); box-shadow: 0 0 0 4px var(--line);
      transition: all 0.3s;
    }
    .dot.up { background: var(--accent); box-shadow: 0 0 0 4px var(--accent-bg); animation: pulse 2s infinite; }
    .dot.down { background: var(--danger); box-shadow: 0 0 0 4px var(--danger-bg); }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 4px var(--accent-bg); }
      50% { box-shadow: 0 0 0 6px var(--accent-bg); }
    }
    .status-label { font-weight: 600; font-size: 15px; }
    .status-sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .status-right { text-align: right; font-size: 12px; color: var(--muted); }

    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    .cell {
      border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px;
    }
    .cell .k { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    .cell .v { font-size: 18px; font-weight: 600; margin-top: 4px; }
    .cell .v.sm { font-size: 14px; }

    pre {
      background: var(--code-bg); border: 1px solid var(--line);
      border-radius: 6px; padding: 14px 16px; margin: 0;
      overflow-x: auto; font-size: 13px; line-height: 1.55;
    }
    code { font-family: var(--mono); }
    .comment { color: var(--muted); }
    .str { color: #116329; }
    .kw { color: #cf222e; }

    .endpoints { border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
    .ep { display: grid; grid-template-columns: 70px 1fr; padding: 10px 16px; border-bottom: 1px solid var(--line); align-items: center; }
    .ep:last-child { border-bottom: none; }
    .ep .m {
      display: inline-block; font-weight: 600; font-size: 11px; letter-spacing: 0.5px;
      padding: 2px 8px; border-radius: 4px; text-align: center;
    }
    .m.get    { background: #dbeafe; color: #1e40af; }
    .m.post   { background: #dcfce7; color: #166534; }
    .m.patch  { background: #fef3c7; color: #92400e; }
    .m.put    { background: #ede9fe; color: #5b21b6; }
    .m.delete { background: #fee2e2; color: #991b1b; }
    .ep .p { font-size: 13px; }
    .ep .p .mu { color: var(--muted); }

    .actions { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }
    .btn {
      border: 1px solid var(--line); border-radius: 6px;
      padding: 8px 14px; font: inherit; text-decoration: none; color: var(--fg);
      display: inline-flex; align-items: center; gap: 6px;
      transition: all 0.15s;
    }
    .btn:hover { border-color: var(--fg); background: #fafafa; }
    .btn.primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
    .btn.primary:hover { opacity: 0.85; background: var(--fg); }

    footer {
      margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--line);
      color: var(--muted); font-size: 12px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
    }
    footer a { color: var(--muted); }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>api-database</h1>
      <span class="ver" id="ver">v…</span>
    </header>

    <div class="section">
      <div class="section-title">status</div>
      <div class="status-card">
        <div class="status-left">
          <span class="dot" id="dot"></span>
          <div>
            <div class="status-label" id="label">verificando…</div>
            <div class="status-sub" id="sub">GET /health</div>
          </div>
        </div>
        <div class="status-right" id="right">—</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">runtime</div>
      <div class="grid">
        <div class="cell">
          <div class="k">uptime</div>
          <div class="v" id="uptime">—</div>
        </div>
        <div class="cell">
          <div class="k">database</div>
          <div class="v" id="db">—</div>
        </div>
        <div class="cell">
          <div class="k">serviço</div>
          <div class="v sm">api-database</div>
        </div>
        <div class="cell">
          <div class="k">host</div>
          <div class="v sm" id="host">—</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">endpoints</div>
      <div class="endpoints">
        <div class="ep"><span class="m get">GET</span><span class="p">/health <span class="mu"># status público</span></span></div>
        <div class="ep"><span class="m post">POST</span><span class="p">/v1/:collection <span class="mu"># criar documento</span></span></div>
        <div class="ep"><span class="m get">GET</span><span class="p">/v1/:collection <span class="mu"># listar</span></span></div>
        <div class="ep"><span class="m get">GET</span><span class="p">/v1/:collection/:id <span class="mu"># ler</span></span></div>
        <div class="ep"><span class="m patch">PATCH</span><span class="p">/v1/:collection/:id <span class="mu"># merge</span></span></div>
        <div class="ep"><span class="m put">PUT</span><span class="p">/v1/:collection/:id <span class="mu"># substituir</span></span></div>
        <div class="ep"><span class="m delete">DELETE</span><span class="p">/v1/:collection/:id <span class="mu"># soft-delete</span></span></div>
        <div class="ep"><span class="m post">POST</span><span class="p">/v1/files/:collection <span class="mu"># upload</span></span></div>
        <div class="ep"><span class="m get">GET</span><span class="p">/v1/files/:id <span class="mu"># download</span></span></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">exemplo</div>
      <pre><code><span class="comment"># criar um documento numa coleção</span>
<span class="kw">curl</span> -X POST https://api.windlog.org/v1/configs \\
  -H <span class="str">"X-API-Key: apidb_live_…"</span> \\
  -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"theme":"dark","locale":"pt-BR"}'</span></code></pre>
    </div>

    <div class="actions">
      <a class="btn primary" href="/admin">Painel admin →</a>
      <a class="btn" href="/health">Ver /health</a>
    </div>

    <footer>
      <span>© api.windlog.org</span>
      <span id="ts">—</span>
    </footer>
  </main>

  <script>
    const fmtUptime = (s) => {
      if (s < 60) return s + 's';
      if (s < 3600) return Math.floor(s/60) + 'm ' + (s%60) + 's';
      const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
      if (s < 86400) return h + 'h ' + m + 'm';
      return Math.floor(s/86400) + 'd ' + h + 'h';
    };

    async function refresh() {
      try {
        const r = await fetch('/health', { cache: 'no-store' });
        const j = await r.json();
        const d = j.data || {};
        const up = j.ok && d.db === 'up';
        document.getElementById('dot').className = 'dot ' + (up ? 'up' : 'down');
        document.getElementById('label').textContent = up ? 'operacional' : 'degradado';
        document.getElementById('sub').textContent = up
          ? 'todos os sistemas no ar'
          : 'banco de dados indisponível';
        document.getElementById('right').textContent = new Date(d.timestamp).toLocaleTimeString();
        document.getElementById('ver').textContent = 'v' + (d.version || '—');
        document.getElementById('uptime').textContent = fmtUptime(d.uptimeSeconds || 0);
        document.getElementById('db').textContent = d.db || '—';
      } catch {
        document.getElementById('dot').className = 'dot down';
        document.getElementById('label').textContent = 'offline';
        document.getElementById('sub').textContent = 'não foi possível contatar /health';
      }
      document.getElementById('host').textContent = location.hostname;
      document.getElementById('ts').textContent = new Date().toISOString();
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;

const landing: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8').send(HTML);
  });
};

export default landing;
