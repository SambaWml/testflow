import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const specUrl = `${proto}://${host}/api/docs`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TestFlow API — Documentação</title>
    <meta name="description" content="Documentação interativa da API do TestFlow." />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧪</text></svg>" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :root {
        --brand: #6d28d9;
        --brand-light: #8b5cf6;
        --brand-dark: #4c1d95;
        --bg: #0f0f13;
        --surface: #18181f;
        --surface2: #1e1e28;
        --border: #2a2a38;
        --text: #e2e2f0;
        --muted: #9090aa;
        --green: #22c55e;
        --blue: #3b82f6;
        --orange: #f97316;
        --red: #ef4444;
        --yellow: #eab308;
        --pink: #ec4899;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
      }

      /* ── Topbar ── */
      #topbar {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 0 24px;
        height: 56px;
        backdrop-filter: blur(8px);
      }
      #topbar .logo {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: var(--text);
      }
      #topbar .logo-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, var(--brand), var(--brand-light));
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }
      #topbar .logo-name { font-weight: 700; font-size: 15px; letter-spacing: -0.3px; }
      #topbar .logo-badge {
        font-size: 10px;
        font-weight: 600;
        background: var(--brand);
        color: #fff;
        padding: 2px 7px;
        border-radius: 99px;
        letter-spacing: 0.5px;
      }
      #topbar .spacer { flex: 1; }
      #topbar .version {
        font-size: 12px;
        color: var(--muted);
        border: 1px solid var(--border);
        padding: 3px 10px;
        border-radius: 99px;
      }
      #topbar .spec-link {
        font-size: 12px;
        color: var(--brand-light);
        text-decoration: none;
        border: 1px solid var(--brand);
        padding: 3px 10px;
        border-radius: 99px;
        transition: background 0.15s;
      }
      #topbar .spec-link:hover { background: var(--brand); color: #fff; }

      /* ── Swagger UI overrides ── */
      .swagger-ui { background: transparent !important; }
      .swagger-ui .wrapper { max-width: 1100px; padding: 0 24px 48px; }

      /* Info block */
      .swagger-ui .info { margin: 32px 0 8px; }
      .swagger-ui .info .title {
        font-size: 28px !important;
        font-weight: 800 !important;
        color: var(--text) !important;
        letter-spacing: -0.5px;
      }
      .swagger-ui .info .title small.version-stamp {
        background: var(--brand);
        color: #fff;
        font-size: 11px;
        padding: 3px 9px;
        border-radius: 99px;
        vertical-align: middle;
        font-weight: 600;
        margin-left: 10px;
      }
      .swagger-ui .info p,
      .swagger-ui .info li,
      .swagger-ui .info table {
        color: var(--muted) !important;
        font-size: 14px !important;
      }
      .swagger-ui .info a { color: var(--brand-light) !important; }
      .swagger-ui .info code { background: var(--surface2) !important; color: var(--brand-light) !important; }

      /* Servers dropdown */
      .swagger-ui .scheme-container { background: var(--surface) !important; box-shadow: none !important; border-bottom: 1px solid var(--border); padding: 12px 24px !important; }
      .swagger-ui .servers label span,
      .swagger-ui .servers > label { color: var(--muted) !important; font-size: 12px !important; }
      .swagger-ui .servers select {
        background: var(--surface2) !important;
        color: var(--text) !important;
        border: 1px solid var(--border) !important;
        border-radius: 6px !important;
        font-size: 13px !important;
        padding: 4px 8px !important;
      }

      /* Tag sections */
      .swagger-ui .opblock-tag {
        border-bottom: 1px solid var(--border) !important;
        color: var(--text) !important;
        font-size: 16px !important;
        font-weight: 700 !important;
      }
      .swagger-ui .opblock-tag:hover { background: rgba(109,40,217,0.06) !important; }
      .swagger-ui .opblock-tag-section { background: transparent !important; }

      /* Operation blocks */
      .swagger-ui .opblock {
        background: var(--surface) !important;
        border: 1px solid var(--border) !important;
        border-radius: 10px !important;
        box-shadow: none !important;
        margin: 6px 0 !important;
      }
      .swagger-ui .opblock:hover { border-color: var(--brand) !important; }
      .swagger-ui .opblock.is-open { border-color: var(--brand) !important; background: var(--surface2) !important; }

      /* Method badges */
      .swagger-ui .opblock-summary-method {
        border-radius: 6px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.5px !important;
        min-width: 58px !important;
        text-align: center !important;
        padding: 4px 8px !important;
      }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: var(--blue) !important; }
      .swagger-ui .opblock.opblock-post .opblock-summary-method { background: var(--green) !important; }
      .swagger-ui .opblock.opblock-put .opblock-summary-method { background: var(--orange) !important; }
      .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: var(--yellow) !important; color: #000 !important; }
      .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: var(--red) !important; }

      .swagger-ui .opblock-summary-path { color: var(--text) !important; font-size: 14px !important; }
      .swagger-ui .opblock-summary-description { color: var(--muted) !important; font-size: 13px !important; }

      /* Headers, labels, descriptions */
      .swagger-ui .tab li,
      .swagger-ui label,
      .swagger-ui .parameter__name,
      .swagger-ui .parameter__type,
      .swagger-ui h4,
      .swagger-ui h5,
      .swagger-ui .response-col_status { color: var(--text) !important; }
      .swagger-ui .parameter__in,
      .swagger-ui .prop-type,
      .swagger-ui .response-col_description { color: var(--muted) !important; }

      /* Tables */
      .swagger-ui table thead tr th,
      .swagger-ui table thead tr td { border-color: var(--border) !important; color: var(--muted) !important; font-size: 12px !important; }
      .swagger-ui table tbody tr td { border-color: var(--border) !important; color: var(--text) !important; }
      .swagger-ui .responses-table .response { background: var(--surface) !important; }

      /* Code / JSON */
      .swagger-ui .highlight-code > pre,
      .swagger-ui .microlight {
        background: #0d0d14 !important;
        border: 1px solid var(--border) !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        color: #a5d6ff !important;
      }
      .swagger-ui .model-box { background: var(--surface2) !important; border: 1px solid var(--border) !important; border-radius: 8px !important; }
      .swagger-ui .model { color: var(--text) !important; }
      .swagger-ui .model .property { color: var(--muted) !important; }
      .swagger-ui .model-toggle { color: var(--brand-light) !important; }
      .swagger-ui section.models { border: 1px solid var(--border) !important; border-radius: 10px !important; background: var(--surface) !important; }
      .swagger-ui section.models h4 { color: var(--text) !important; }
      .swagger-ui section.models .model-container { background: var(--surface2) !important; border: 1px solid var(--border) !important; }

      /* Execute button */
      .swagger-ui .btn.execute {
        background: var(--brand) !important;
        border-color: var(--brand) !important;
        color: #fff !important;
        border-radius: 7px !important;
        font-weight: 600 !important;
        letter-spacing: 0.3px !important;
      }
      .swagger-ui .btn.execute:hover { background: var(--brand-dark) !important; }
      .swagger-ui .btn.cancel { border-color: var(--border) !important; color: var(--muted) !important; border-radius: 7px !important; }
      .swagger-ui .btn { border-radius: 7px !important; }

      /* Try-it-out inputs */
      .swagger-ui input[type=text],
      .swagger-ui input[type=password],
      .swagger-ui input[type=search],
      .swagger-ui textarea,
      .swagger-ui select {
        background: var(--surface2) !important;
        border: 1px solid var(--border) !important;
        color: var(--text) !important;
        border-radius: 6px !important;
        font-size: 13px !important;
      }
      .swagger-ui input:focus,
      .swagger-ui textarea:focus { border-color: var(--brand) !important; outline: none !important; }

      /* Authorize */
      .swagger-ui .auth-wrapper { background: var(--surface) !important; border: 1px solid var(--border) !important; border-radius: 10px !important; }
      .swagger-ui .auth-wrapper .btn-done { background: var(--brand) !important; color: #fff !important; border-radius: 7px !important; }

      /* Response codes */
      .swagger-ui .response-col_status { font-weight: 700 !important; }

      /* Arrow expand icons */
      .swagger-ui .arrow { fill: var(--brand-light) !important; }
      .swagger-ui .expand-operation svg { fill: var(--muted) !important; }
      .swagger-ui .opblock-summary-control svg { fill: var(--muted) !important; }

      /* Filter input */
      .swagger-ui .filter .operation-filter-input {
        border: 1px solid var(--border) !important;
        background: var(--surface) !important;
        color: var(--text) !important;
        border-radius: 7px !important;
      }

      /* Copy btn */
      .swagger-ui .copy-to-clipboard { background: var(--surface2) !important; border: 1px solid var(--border) !important; border-radius: 6px !important; }
      .swagger-ui .copy-to-clipboard button svg { fill: var(--muted) !important; }

      /* Hide logo */
      .swagger-ui .topbar { display: none !important; }

      /* Scrollbar */
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: var(--bg); }
      ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: var(--brand); }
    </style>
  </head>
  <body>
    <div id="topbar">
      <a class="logo" href="/">
        <div class="logo-icon">🧪</div>
        <span class="logo-name">TestFlow</span>
        <span class="logo-badge">API</span>
      </a>
      <div class="spacer"></div>
      <span class="version">v1.0.0</span>
      <a class="spec-link" href="/api/docs" target="_blank">OpenAPI JSON ↗</a>
    </div>

    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        SwaggerUIBundle({
          url: "${specUrl}",
          dom_id: "#swagger-ui",
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout",
          deepLinking: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
          persistAuthorization: true,
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 2,
          docExpansion: "none",
          syntaxHighlight: { activate: true, theme: "agate" },
        });
      };
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
