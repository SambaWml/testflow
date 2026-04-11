import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  PASS: "Pass", FAIL: "Fail", BLOCKED: "Blocked",
  NOT_EXECUTED: "Não Executado", RETEST: "Retest", SKIPPED: "Skipped",
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseUrl = new URL(req.url).origin;

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      author: { select: { name: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          execution: {
            include: {
              case: { select: { title: true, format: true } },
              executor: { select: { name: true } },
              evidence: true,
            },
          },
        },
      },
    },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta = JSON.parse(report.metadata || "{}");
  const passRate = meta.passRate ?? 0;
  const counts = meta.counts ?? {};

  // Generate HTML for the PDF (returned as HTML for browser printing)
  const rows = report.items.map(({ execution: ex }, i: number) => {
    const images = ex.evidence.filter((ev: { type: string; storageKey: string | null }) => ev.type === "IMAGE" && ev.storageKey);
    const imgHtml = images.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:2px">${images.map((ev: { storageKey: string }, idx: number) =>
          `<a href="${baseUrl}${ev.storageKey}" style="font-size:11px;color:#2563eb;text-decoration:underline">🖼 Evidência ${idx + 1}</a>`
        ).join("")}</div>`
      : "";
    return `
    <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${ex.case.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${ex.executor.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
        <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${statusColor(ex.status)};color:#fff">
          ${STATUS_LABELS[ex.status] ?? ex.status}
        </span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${ex.relatedBugRef ?? "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${imgHtml || (ex.evidence.length > 0 ? `${ex.evidence.length}` : "—")}</td>
    </tr>
  `;
  }).join("");

  const statusRows = Object.entries(counts).map(([s, v]) => `
    <tr>
      <td style="padding:6px 12px">${STATUS_LABELS[s] ?? s}</td>
      <td style="padding:6px 12px;font-weight:700">${v}</td>
      <td style="padding:6px 12px">${report.items.length > 0 ? Math.round((Number(v) / report.items.length) * 100) : 0}%</td>
    </tr>
  `).join("");

  const bugs = [...new Set(report.items
    .filter(({ execution: ex }) => ex.relatedBugRef)
    .map(({ execution: ex }) => ex.relatedBugRef!))];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${report.title} — TestFlow</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; background: #fff; }
    .page { max-width: 900px; margin: 0 auto; padding: 40px; }
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 3px solid #2563eb; margin-bottom: 32px; }
    .logo { font-size: 24px; font-weight: 800; color: #2563eb; }
    .title { font-size: 20px; font-weight: 700; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .meta-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
    .meta-value { font-size: 16px; font-weight: 700; }
    .pass-rate { font-size: 36px; font-weight: 900; color: ${passRate >= 80 ? "#22c55e" : passRate >= 50 ? "#f59e0b" : "#ef4444"}; }
    h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #1e293b; border-left: 4px solid #2563eb; padding-left: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 13px; }
    th { background: #2563eb; color: #fff; padding: 10px 12px; text-align: left; font-weight: 600; font-size: 12px; }
    .bug-tag { display: inline-block; padding: 3px 8px; border-radius: 12px; background: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 600; margin: 2px; }
    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { .page { padding: 20px; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">⚗ TestFlow</div>
        <p style="font-size:12px;color:#64748b;margin-top:2px">Relatório de Testes</p>
      </div>
      <div style="text-align:right">
        <div class="title">${report.title}</div>
        <div class="subtitle">Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")}</div>
      </div>
    </div>

    <!-- Meta -->
    <div class="meta-grid">
      <div class="meta-card"><div class="meta-label">Projeto</div><div class="meta-value">${report.project.name}</div></div>
      <div class="meta-card"><div class="meta-label">Responsável</div><div class="meta-value">${report.author.name}</div></div>
      <div class="meta-card"><div class="meta-label">Ambiente</div><div class="meta-value">${report.environment ?? "—"}</div></div>
      <div class="meta-card"><div class="meta-label">Build</div><div class="meta-value">${report.buildVersion ?? "—"}</div></div>
      <div class="meta-card"><div class="meta-label">Total de Casos</div><div class="meta-value">${report.items.length}</div></div>
      <div class="meta-card"><div class="meta-label">Taxa de Aprovação</div><div class="pass-rate">${passRate}%</div></div>
    </div>

    <!-- Status Summary -->
    <h2>Resumo de Status</h2>
    <table>
      <thead><tr><th>Status</th><th>Quantidade</th><th>Percentual</th></tr></thead>
      <tbody>${statusRows}</tbody>
    </table>

    <!-- Cases -->
    <h2>Casos Executados</h2>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Caso de Teste</th><th>Executor</th><th>Status</th><th>Bug</th><th>Evidências</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${bugs.length > 0 ? `
    <h2>Bugs Encontrados</h2>
    <div style="margin-bottom:32px">
      ${bugs.map((b) => `<span class="bug-tag">🐛 ${b}</span>`).join("")}
    </div>` : ""}

    ${report.notes ? `
    <h2>Observações Finais</h2>
    <div class="notes-box">${report.notes}</div>` : ""}

    <div class="footer">
      Gerado pelo TestFlow · ${new Date().toLocaleDateString("pt-BR")}
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    PASS: "#22c55e", FAIL: "#ef4444", BLOCKED: "#f97316",
    NOT_EXECUTED: "#94a3b8", RETEST: "#3b82f6", SKIPPED: "#a855f7",
  };
  return map[status] ?? "#94a3b8";
}
