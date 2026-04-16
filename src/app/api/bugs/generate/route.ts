import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAIConfig } from "@/lib/ai-config";
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

export type GeneratedBug = {
  title: string;
  description: string;
  priority: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  affectedArea: string;
  notes: string | null;
};

export async function POST(req: Request) {
  // Auth check
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId && !u.isSuperAdmin) return NextResponse.json({ error: "No organization" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      itemId,
      manualDescription,
      quantity = 5,
      language = "pt-BR",
      priority = "mixed",
      bugCategory = "functional",
    } = body;

    let context = "";

    if (itemId) {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (item) {
        const parts = [`Funcionalidade: ${item.title}`];
        if (item.description?.trim()) parts.push(`Descrição: ${item.description}`);
        if (item.acceptanceCriteria?.trim()) parts.push(`Critérios de Aceite: ${item.acceptanceCriteria}`);
        if (item.notes?.trim()) parts.push(`Observações: ${item.notes}`);
        context = parts.join("\n");
      }
    }

    if (manualDescription?.trim()) {
      context = context
        ? `${context}\n\nContexto adicional:\n${manualDescription.trim()}`
        : manualDescription.trim();
    }

    if (!context.trim()) {
      return NextResponse.json({ error: "Forneça uma descrição ou selecione uma funcionalidade." }, { status: 400 });
    }

    const aiConfig = await getAIConfig();
    const options = { context, quantity, language, priority, bugCategory };

    if (aiConfig.activeProvider === "manus" && aiConfig.manus.apiKey) {
      try {
        return await generateWithManus({
          ...options,
          apiKey: aiConfig.manus.apiKey,
          baseUrl: aiConfig.manus.baseUrl.replace(/\/$/, ""),
        });
      } catch (err) {
        console.error("Manus failed:", err);
        return NextResponse.json({
          error: `Manus IA falhou: ${String(err)}`,
          hint: "Verifique se a chave da Manus está correta e o serviço está disponível.",
        }, { status: 503 });
      }
    }

    if (aiConfig.activeProvider === "openai" && aiConfig.openai.apiKey) {
      try {
        return await generateWithLLM({
          ...options,
          baseUrl: "https://api.openai.com/v1",
          model: aiConfig.openai.model,
          apiKey: aiConfig.openai.apiKey,
        });
      } catch (err) {
        console.error("OpenAI failed:", err);
        return NextResponse.json({
          error: `OpenAI falhou: ${String(err)}`,
          hint: "Verifique se a API Key está correta e tem créditos disponíveis.",
        }, { status: 503 });
      }
    }

    if (aiConfig.activeProvider === "claude" && aiConfig.claude.apiKey) {
      try {
        return await generateWithClaude({
          ...options,
          model: aiConfig.claude.model,
          apiKey: aiConfig.claude.apiKey,
        });
      } catch (err) {
        console.error("Claude failed:", err);
        return NextResponse.json({
          error: `Claude falhou: ${String(err)}`,
          hint: "Verifique se a API Key da Anthropic está correta.",
        }, { status: 503 });
      }
    }

    return NextResponse.json({
      error: "Nenhum provedor de IA configurado.",
      hint: "Configure um provedor em Painel Admin → Configuração IA.",
    }, { status: 503 });
  } catch (error) {
    console.error("API bugs/generate error:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar a requisição", detail: String(error) },
      { status: 500 }
    );
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt({
  context, quantity, language, priority, bugCategory,
}: {
  context: string; quantity: number; language: string; priority: string; bugCategory: string;
}): string {
  const langLabel = { "pt-BR": "Português Brasileiro", en: "English", es: "Español" }[language] ?? language;

  const priorityInstruction = priority === "mixed"
    ? "Distribua as prioridades: misture CRITICAL, HIGH, MEDIUM e LOW de forma realista."
    : `Use a prioridade "${priority.toUpperCase()}" para todos os bugs.`;

  const categoryLabel: Record<string, string> = {
    functional: "funcional (lógica de negócio, fluxos incorretos, validações falhas)",
    ui: "interface do usuário (layout, elementos faltando, textos errados, responsividade)",
    performance: "performance (lentidão, timeouts, consumo excessivo de recursos)",
    security: "segurança (acesso não autorizado, exposição de dados, injeção)",
    integration: "integração (falhas em APIs, webhooks, comunicação entre módulos)",
    data: "dados (corrupção, inconsistência, perda de informações)",
    accessibility: "acessibilidade (contraste, foco, leitores de tela, ARIA)",
  };

  return `Você é um analista de QA sênior especialista em documentação de bugs. Gere exatamente ${quantity} relatórios de bug em ${langLabel} para a seguinte funcionalidade/sistema:

FUNCIONALIDADE / CONTEXTO:
${context}

CATEGORIA DE BUG: ${categoryLabel[bugCategory] ?? bugCategory}
${priorityInstruction}

REGRAS:
- Escreva em ${langLabel} correto e profissional.
- Cada bug deve ser único, específico e realista para o contexto fornecido.
- Nunca use placeholders genéricos como "ação 1", "dados inválidos", "resultado X".
- Os passos para reproduzir devem ser numerados e detalhados.
- O título deve ser curto e descritivo (máx 100 caracteres).

Retorne SOMENTE um objeto JSON com a chave "bugs" mapeando para um array. Cada bug deve ter:
- "title": string (título curto e descritivo do bug)
- "description": string (descrição completa do problema observado)
- "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
- "stepsToReproduce": string (passos numerados para reproduzir o bug)
- "expectedResult": string (o que deveria acontecer)
- "actualResult": string (o que acontece de fato)
- "affectedArea": string (módulo ou área do sistema afetada)
- "notes": string | null (observações adicionais, ambientes específicos, etc.)

Exemplo de um bug:
{"title":"Filtro de data não retorna resultados ao selecionar intervalo maior que 90 dias","description":"Ao aplicar um filtro de data com intervalo superior a 90 dias na tela de relatórios, a listagem retorna vazia mesmo havendo registros no período selecionado.","priority":"HIGH","stepsToReproduce":"1. Acessar a tela de Relatórios\\n2. Clicar no filtro de Data\\n3. Selecionar data inicial: 01/01/2024\\n4. Selecionar data final: 31/12/2024\\n5. Clicar em Filtrar","expectedResult":"O sistema exibe todos os relatórios gerados no período de 01/01/2024 a 31/12/2024","actualResult":"A listagem retorna vazia com a mensagem 'Nenhum resultado encontrado'","affectedArea":"Relatórios","notes":"Reproduzível apenas com intervalos maiores que 90 dias. Intervalos de até 90 dias funcionam corretamente."}

Sem markdown, sem blocos de código, sem nenhum texto fora do JSON.`;
}

// ─── Parser/normalizer ────────────────────────────────────────────────────────

function extractBalancedJSON(str: string): string {
  const start = str.search(/[{[]/);
  if (start === -1) throw new Error(`Sem JSON na resposta: ${str.slice(0, 300)}`);
  const opener = str[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0; let inString = false; let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) { depth--; if (depth === 0) return str.slice(start, i + 1); }
  }
  throw new Error(`JSON desbalanceado: ${str.slice(0, 300)}`);
}

function sanitizeJSON(str: string): string {
  return str
    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1")
    .replace(/:\s*\.\.\./g, ": null")
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/([{,]\s*)'([^'\n]+)'(\s*:)/g, '$1"$2"$3')
    .replace(/(:\s*)'([^'\n]*)'/g, ': "$2"');
}

function tryParseJSON(str: string): unknown {
  try { return JSON.parse(str); } catch { return undefined; }
}

function normalizeBug(b: Record<string, unknown>): GeneratedBug {
  const priority = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(String(b.priority ?? b.prioridade ?? "").toUpperCase())
    ? String(b.priority ?? b.prioridade).toUpperCase()
    : "MEDIUM";

  return {
    title: String(
      b.title ?? b.titulo ?? b.name ?? b.bug_title ?? b.bugTitle ?? ""
    ).trim().slice(0, 200),
    description: String(
      b.description ?? b.descricao ?? b.descrição ?? b.desc ?? b.summary ?? ""
    ).trim(),
    priority,
    stepsToReproduce: String(
      b.stepsToReproduce ?? b.steps_to_reproduce ?? b.passos ?? b.steps ??
      b.stepsToReproduce ?? b.reproduction_steps ?? b.howToReproduce ?? ""
    ).trim(),
    expectedResult: String(
      b.expectedResult ?? b.expected_result ?? b.resultadoEsperado ?? b.expected ?? ""
    ).trim(),
    actualResult: String(
      b.actualResult ?? b.actual_result ?? b.resultadoAtual ?? b.actual ?? ""
    ).trim(),
    affectedArea: String(
      b.affectedArea ?? b.affected_area ?? b.areaAfetada ?? b.area ?? b.module ?? b.component ?? ""
    ).trim(),
    notes: (b.notes ?? b.observacoes ?? b.observações ?? null)
      ? String(b.notes ?? b.observacoes ?? b.observações)
      : null,
  };
}

/** Returns true only if the bug has at least a title and description — rejects message/tool objects */
function isBugLike(b: Record<string, unknown>): boolean {
  const title = String(
    b.title ?? b.titulo ?? b.name ?? b.bug_title ?? b.bugTitle ?? ""
  ).trim();
  const desc = String(
    b.description ?? b.descricao ?? b.descrição ?? b.desc ?? b.summary ?? ""
  ).trim();
  return title.length > 0 && desc.length > 0;
}

function parseAndNormalize(raw: unknown): NextResponse {
  // Already an object with .bugs
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.bugs)) {
      const validBugs = (obj.bugs as Record<string, unknown>[]).filter(isBugLike).map(normalizeBug);
      if (validBugs.length === 0) throw new Error("Array .bugs parsed but no valid bug objects found");
      return NextResponse.json({ bugs: validBugs });
    }
  }
  // Already an array
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
    const validBugs = (raw as Record<string, unknown>[]).filter(isBugLike).map(normalizeBug);
    if (validBugs.length > 0) return NextResponse.json({ bugs: validBugs });
    // Not bugs — could be message objects; try extracting content from each
    for (let j = raw.length - 1; j >= 0; j--) {
      const item = raw[j] as Record<string, unknown>;
      const content = item.content ?? item.text ?? item.message ?? item.result ?? item.output;
      if (typeof content === "string" && content.trim().length > 10) {
        try { return parseAndNormalize(content); } catch { /* try next */ }
      }
    }
    throw new Error("Array sem bugs válidos e sem conteúdo extraível.");
  }

  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  const cleaned = sanitizeJSON(str.replace(/<think>[\s\S]*?<\/think>/gi, "").trim());

  let jsonStr: string;
  try { jsonStr = extractBalancedJSON(cleaned); }
  catch (e) { throw new Error(`Falha ao extrair JSON: ${e}. Preview: ${cleaned.slice(0, 200)}`); }

  let parsed: unknown;
  try { parsed = JSON.parse(jsonStr); }
  catch {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const arrParsed = tryParseJSON(arrMatch[0]);
      if (Array.isArray(arrParsed)) {
        return NextResponse.json({ bugs: (arrParsed as Record<string, unknown>[]).map(normalizeBug) });
      }
    }
    throw new Error(`JSON.parse falhou. Preview: ${jsonStr.slice(0, 300)}`);
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.bugs)) {
      const validBugs = (obj.bugs as Record<string, unknown>[]).filter(isBugLike).map(normalizeBug);
      if (validBugs.length === 0) throw new Error("Array .bugs parsed but no valid bug objects found");
      return NextResponse.json({ bugs: validBugs });
    }
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    const validBugs = (parsed as Record<string, unknown>[]).filter(isBugLike).map(normalizeBug);
    if (validBugs.length > 0) return NextResponse.json({ bugs: validBugs });
    // Not bugs — try extracting content from each item (message array)
    for (let j = parsed.length - 1; j >= 0; j--) {
      const item = parsed[j] as Record<string, unknown>;
      const content = item.content ?? item.text ?? item.message ?? item.result ?? item.output;
      if (typeof content === "string" && content.trim().length > 10) {
        try { return parseAndNormalize(content); } catch { /* try next */ }
      }
    }
    throw new Error("Array sem bugs válidos e sem conteúdo extraível.");
  }

  throw new Error(`Não encontrei array de bugs. Preview: ${cleaned.slice(0, 200)}`);
}

// ─── Deep extractor ──────────────────────────────────────────────────────────

/** Recursively scans any value looking for bugs — handles objects, arrays, and JSON strings */
function extractBugsDeep(value: unknown, depth = 0): NextResponse | null {
  if (depth > 8 || value === null || value === undefined) return null;

  // Object with a .bugs array — this is the target format
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.bugs) && obj.bugs.length > 0) {
      const valid = (obj.bugs as Record<string, unknown>[]).filter(isBugLike).map(normalizeBug);
      if (valid.length > 0) return NextResponse.json({ bugs: valid });
    }
    // Recurse into all values, last fields first (output tends to be at the end)
    for (const v of Object.values(obj).reverse()) {
      const r = extractBugsDeep(v, depth + 1);
      if (r) return r;
    }
    return null;
  }

  // Array — could be a bugs array itself or contain the response somewhere
  if (Array.isArray(value)) {
    // Try as direct bugs array
    if (value.length > 0 && typeof value[0] === "object") {
      const valid = (value as Record<string, unknown>[]).filter(isBugLike).map(normalizeBug);
      if (valid.length > 0) return NextResponse.json({ bugs: valid });
    }
    // Recurse items in reverse (last item most likely to be the final response)
    for (let j = value.length - 1; j >= 0; j--) {
      const r = extractBugsDeep(value[j], depth + 1);
      if (r) return r;
    }
    return null;
  }

  // String — try to parse as JSON
  if (typeof value === "string" && value.trim().length > 20) {
    try {
      const parsed = JSON.parse(sanitizeJSON(value));
      const r = extractBugsDeep(parsed, depth + 1);
      if (r) return r;
    } catch { /* not valid JSON */ }
    // Try the full parseAndNormalize pipeline as fallback
    try { return parseAndNormalize(value); } catch { /* not parseable */ }
  }

  return null;
}

// ─── Manus ────────────────────────────────────────────────────────────────────

async function generateWithManus({
  context, quantity, language, priority, bugCategory, apiKey, baseUrl,
}: {
  context: string; quantity: number; language: string; priority: string;
  bugCategory: string; apiKey: string; baseUrl: string;
}): Promise<NextResponse> {
  const basePrompt = buildPrompt({ context, quantity, language, priority, bugCategory });
  const prompt = `${basePrompt}\n\nCRÍTICO: NÃO crie arquivos. Sua resposta final deve ser APENAS o JSON puro com a chave "bugs".`;

  const createRes = await fetch(`${baseUrl}/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "API_KEY": apiKey },
    body: JSON.stringify({ prompt }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Manus create task failed (${createRes.status}): ${err}`);
  }

  const task = await createRes.json();
  const taskId = task.id ?? task.task_id;
  if (!taskId) throw new Error(`Manus não retornou task ID. Resposta: ${JSON.stringify(task)}`);

  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(`${baseUrl}/v1/tasks/${taskId}`, { headers: { "API_KEY": apiKey } });
    if (!pollRes.ok) continue;
    const data = await pollRes.json();
    const status = (data.status ?? "").toLowerCase();
    if (["failed", "error", "cancelled"].includes(status)) throw new Error(`Manus task ${status}`);
    if (["completed", "done", "succeeded", "success"].includes(status)) {
      // Deep-scan the entire response object for bugs — handles any nesting level
      const found = extractBugsDeep(data);
      if (found) return found;

      throw new Error(`Não foi possível extrair bugs do response da Manus. Preview: ${JSON.stringify(data).slice(0, 300)}`);
    }
  }
  throw new Error("Manus task excedeu o tempo limite de 5 minutos.");
}

// ─── OpenAI-compatible ────────────────────────────────────────────────────────

async function generateWithLLM({
  context, quantity, language, priority, bugCategory, baseUrl, model, apiKey,
}: {
  context: string; quantity: number; language: string; priority: string;
  bugCategory: string; baseUrl: string; model: string; apiKey: string;
}): Promise<NextResponse> {
  const prompt = buildPrompt({ context, quantity, language, priority, bugCategory });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Você é um analista de QA sênior especialista em documentação de bugs. Escreva sempre em português brasileiro correto. Responda SOMENTE com JSON puro e válido — sem markdown, sem blocos de código.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      ...(apiKey !== "ollama" && { response_format: { type: "json_object" } }),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro na LLM (${response.status}): ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return parseAndNormalize(raw);
}

// ─── Claude (Anthropic) ─────────────────────────────────────────────────────

async function generateWithClaude({
  context, quantity, language, priority, bugCategory, model, apiKey,
}: {
  context: string; quantity: number; language: string; priority: string;
  bugCategory: string; model: string; apiKey: string;
}): Promise<NextResponse> {
  const prompt = buildPrompt({ context, quantity, language, priority, bugCategory });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API erro (${response.status}): ${err}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? "{}";
  return parseAndNormalize(raw);
}
