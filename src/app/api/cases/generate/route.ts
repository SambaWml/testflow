import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Priority order for AI provider:
// 1. Ollama (OLLAMA_URL set)
// 2. OpenAI (OPENAI_API_KEY set)
// 3. Mock (nenhuma variável configurada)

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      itemId, manualDescription,
      quantity = 5, format = "BDD",
      language = "pt-BR", coverageLevel = "standard", testType = "functional",
    } = body;

    let context = "";

    if (itemId) {
      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (item) {
        const parts = [`Título: ${item.title}`];
        if (item.description?.trim()) parts.push(`Descrição: ${item.description}`);
        if (item.acceptanceCriteria?.trim()) parts.push(`Critérios de Aceite: ${item.acceptanceCriteria}`);
        if (item.notes?.trim()) parts.push(`Observações: ${item.notes}`);
        context = parts.join("\n");
      }
    }

    // Combina contexto do item com descrição manual (não sobrescreve)
    if (manualDescription?.trim()) {
      context = context
        ? `${context}\n\nContexto adicional:\n${manualDescription.trim()}`
        : manualDescription.trim();
    }

    if (!context.trim()) {
      return NextResponse.json({ error: "Forneça uma descrição ou selecione um item com descrição." }, { status: 400 });
    }

    console.log("[generate] context length:", context.length, "| preview:", context.slice(0, 120));

    const ollamaUrl = process.env.OLLAMA_URL;
    const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";
    const openaiKey = process.env.OPENAI_API_KEY;
    const manusKey = process.env.MANUS_API_KEY;
    const manusBaseUrl = (process.env.MANUS_BASE_URL ?? "https://api.manus.ai").replace(/\/$/, "");

    const options = { context, quantity, format, language, coverageLevel, testType };

    if (manusKey) {
      try {
        return await generateWithManus({ ...options, apiKey: manusKey, baseUrl: manusBaseUrl });
      } catch (err) {
        const msg = String(err);
        console.error("Manus failed:", msg);
        if (!ollamaUrl && !openaiKey) {
          return NextResponse.json({
            error: `Manus IA falhou: ${msg}`,
            hint: "Verifique se MANUS_API_KEY está correta e o serviço está disponível.",
            provider: "manus",
          }, { status: 503 });
        }
      }
    }

    if (ollamaUrl) {
      try {
        return await generateWithLLM({
          ...options,
          baseUrl: `${ollamaUrl.replace(/\/$/, "")}/v1`,
          model: ollamaModel,
          apiKey: "ollama",
        });
      } catch (err) {
        const msg = String(err);
        console.error("Ollama failed:", msg);
        if (!openaiKey) {
          return NextResponse.json({
            error: `Ollama falhou: ${msg}`,
            hint: "Verifique se o Ollama está rodando e o modelo '${ollamaModel}' está instalado. Execute: ollama serve && ollama pull ${ollamaModel}",
            provider: "ollama",
          }, { status: 503 });
        }
      }
    }

    if (openaiKey) {
      try {
        return await generateWithLLM({
          ...options,
          baseUrl: "https://api.openai.com/v1",
          model: process.env.OPENAI_MODEL ?? "gpt-4o",
          apiKey: openaiKey,
        });
      } catch (err) {
        console.error("OpenAI failed:", err);
        return NextResponse.json({
          error: `OpenAI falhou: ${String(err)}`,
          hint: "Verifique se a OPENAI_API_KEY está correta e tem créditos disponíveis.",
          provider: "openai",
        }, { status: 503 });
      }
    }

    return NextResponse.json({
      error: "Nenhum provedor de IA configurado.",
      hint: "Configure OLLAMA_URL ou OPENAI_API_KEY no arquivo .env.local e reinicie o servidor.",
      provider: "none",
    }, { status: 503 });
  } catch (error) {
    console.error("API generate error:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar a requisição", detail: String(error) },
      { status: 500 }
    );
  }
}

// ─── Manus IA (Task-based async API) ────────────────────────────────────────

async function generateWithManus({
  context, quantity, format, language, coverageLevel, testType, apiKey, baseUrl,
}: {
  context: string; quantity: number; format: string; language: string;
  coverageLevel: string; testType: string; apiKey: string; baseUrl: string;
}): Promise<NextResponse> {
  const basePrompt = buildPrompt({ context, quantity, format, language, coverageLevel, testType });
  // Instrução explícita para não criar arquivos — Manus é um agente e tende a salvar arquivos
  const prompt = `${basePrompt}\n\nCRÍTICO: NÃO crie arquivos. NÃO use ferramentas de escrita. Sua resposta final deve ser APENAS o JSON puro, escrito diretamente no campo de resultado da tarefa. Nenhum texto antes ou depois do JSON.`;

  // 1. Criar task
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

  console.log("[manus] task criada:", taskId);

  // 2. Polling até completar (máx 5 min)
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollRes = await fetch(`${baseUrl}/v1/tasks/${taskId}`, {
      headers: { "API_KEY": apiKey },
    });
    if (!pollRes.ok) continue;

    const data = await pollRes.json();
    const status = (data.status ?? "").toLowerCase();
    console.log(`[manus] poll ${i + 1}: status=${status}`);

    if (["failed", "error", "cancelled"].includes(status)) {
      throw new Error(`Manus task ${status}: ${data.error ?? JSON.stringify(data)}`);
    }

    if (["completed", "done", "succeeded", "success"].includes(status)) {
      console.log("[manus] task completed, top-level keys:", Object.keys(data));
      console.log("[manus] output type:", typeof data.output, Array.isArray(data.output) ? `array(${data.output.length})` : "");

      // Extrai texto recursivamente de estruturas aninhadas (Anthropic-style, etc.)
      // Retorna "" para objetos envelope — evita que o wrapper seja confundido com o JSON de casos
      function deepText(val: unknown): string {
        if (!val) return "";
        if (typeof val === "string") return val;
        if (Array.isArray(val)) {
          // Retorna o primeiro elemento que tiver "cases": [ (JSON real, não texto do prompt)
          const hasCasesArray = (t: string) => /"cases"\s*:\s*\[/.test(t);
          const withCases = val.map(deepText).find(hasCasesArray);
          return withCases ?? val.map(deepText).filter(Boolean).join("\n");
        }
        if (typeof val === "object") {
          const o = val as Record<string, unknown>;
          // Se já é o objeto de casos, serializa diretamente
          if (Array.isArray(o.cases)) return JSON.stringify(o);
          // Folha de texto: {type:"text", text:"..."}
          if (typeof o.text === "string") return o.text;
          // Wrappers comuns — recursão
          for (const f of ["content", "message", "result", "output", "response"]) {
            if (o[f]) {
              const t = deepText(o[f]);
              if (t) return t;
            }
          }
          // Varre todos os valores em busca de "cases": [ (JSON real)
          for (const v of Object.values(o)) {
            if (v && typeof v !== "number" && typeof v !== "boolean") {
              const t = deepText(v);
              if (/"cases"\s*:\s*\[/.test(t)) return t;
            }
          }
          return "";
        }
        return "";
      }

      // Prioridade: output (campo principal do Manus) > outros campos de texto
      // metadata.task_title é APENAS o título (truncado) — ignorar para parse
      const candidates: Array<[string, string]> = [
        ["output", deepText(data.output)],
        ["result", deepText(data.result)],
        ["response", deepText(data.response)],
        ["content", deepText(data.content)],
        ["message", deepText(data.message)],
        ["answer", deepText(data.answer)],
      ];

      for (const [field, text] of candidates) {
        if (!text || !/"cases"\s*:\s*\[/.test(text)) continue;
        console.log(`[manus] found "cases": [ in field "${field}", length=${text.length}`);
        return parseAndNormalize(text, format);
      }

      const allStr = JSON.stringify(data);
      throw new Error(`Manus não retornou JSON com casos de teste. Campos: ${Object.keys(data).join(", ")}. output preview: ${deepText(data.output).slice(0, 300)}`);
    }
  }

  throw new Error("Manus task excedeu o tempo limite de 5 minutos.");
}

// ─── Prompt builder (compartilhado) ─────────────────────────────────────────

function buildPrompt({
  context, quantity, format, language, coverageLevel, testType,
}: {
  context: string; quantity: number; format: string; language: string;
  coverageLevel: string; testType: string;
}): string {
  const langLabel = { "pt-BR": "Português Brasileiro", en: "English", es: "Español" }[language] ?? language;
  const coverageLabel = {
    basic: "básica — apenas happy path",
    standard: "padrão — happy path + edge cases",
    comprehensive: "abrangente — happy, edge cases e cenários negativos",
  }[coverageLevel] ?? "padrão";

  const formatInstructions = format === "BDD"
    ? `Cada objeto deve ter: "title", "precondition" (string|null), "priority" ("HIGH"|"MEDIUM"|"LOW"), "format": "BDD", "bddGiven", "bddWhen", "bddThen", "notes" (string|null).
Exemplo: {"title":"Exibir lista de usuários","precondition":"Admin autenticado","priority":"HIGH","format":"BDD","bddGiven":"que o administrador está na tela de User Levels","bddWhen":"a tela carregar os dados","bddThen":"o sistema exibe a lista com nome, e-mail e último acesso","notes":"Cobertura: AC1"}`
    : `Cada objeto deve ter: "title", "precondition" (string ou null), "priority" ("HIGH", "MEDIUM" ou "LOW"), "format": "STEP_BY_STEP", "steps" (array de passos, onde cada passo tem "order" com valor inteiro e "description" com valor string), "expectedResult", "notes" (string ou null).
Exemplo: {"title":"Alterar nível de acesso","precondition":"Admin autenticado","priority":"HIGH","format":"STEP_BY_STEP","steps":[{"order":1,"description":"Acessar User Levels"},{"order":2,"description":"Localizar o usuário"},{"order":3,"description":"Selecionar novo nível"},{"order":4,"description":"Confirmar alteração"}],"expectedResult":"Nível atualizado com sucesso e lista reflete a mudança","notes":"Cobertura: AC3"}`;

  return `Você é um analista de QA sênior. Gere exatamente ${quantity} casos de teste em ${langLabel} no formato ${format === "BDD" ? "BDD" : "Step by Step"}.

REQUISITO:
${context}

REGRAS:
- Escreva em ${langLabel} correto e profissional.
- Cada caso cobre um comportamento específico do requisito.
- Nunca use placeholders: "ação 1", "cenário 1", "dados válidos", "resultado esperado".
- Tipo de teste: ${testType} | Cobertura: ${coverageLabel}
- Cubra quando aplicável: fluxo feliz, campos obrigatórios, erros, permissões, edge cases.

${formatInstructions}

Retorne SOMENTE um objeto JSON com a chave "cases" mapeando para um array de casos de teste. Sem markdown, sem blocos de código, sem nenhum texto fora do JSON.`;
}

// ─── Parser/normalizer (compartilhado) ───────────────────────────────────────

/** Extrai o primeiro objeto JSON balanceado de uma string, ignorando conteúdo extra antes/depois. */
function extractBalancedJSON(str: string): string {
  const start = str.search(/[{[]/);
  if (start === -1) throw new Error(`Sem JSON na resposta: ${str.slice(0, 300)}`);
  const opener = str[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  throw new Error(`JSON desbalanceado na resposta: ${str.slice(0, 300)}`);
}

/** Corrige problemas comuns de JSON gerado por LLMs */
function sanitizeJSON(str: string): string {
  return str
    .replace(/:\s*\.\.\./g, ": null")           // bare ... como valor  → null
    .replace(/,(\s*[}\]])/g, "$1")              // trailing commas
    .replace(/([{,]\s*)'([^'\n]+)'(\s*:)/g, '$1"$2"$3')  // chaves com aspas simples
    .replace(/(:\s*)'([^'\n]*)'/g, ': "$2"')    // valores com aspas simples
    // nome de tipo JS (number/string/boolean) usado como valor literal sem aspas
    .replace(/(:\s*)(number|string|boolean)(\s*[,}\]])/g, (_, colon, type, suffix) => {
      const val = type === "number" ? "0" : type === "boolean" ? "false" : '""';
      return `${colon}${val}${suffix}`;
    })
    // \n literal (barra+n) entre tokens fora de strings → espaço válido
    .replace(/\\n(\s*[,}\]])/g, " $1")
    // 'n' solto logo após aspas de fechamento antes de delimitador (artefato de \n)
    .replace(/"n(\s*[,}\]])/g, '"$1');
}

function tryParseJSON(str: string): unknown {
  try { return JSON.parse(str); } catch { return undefined; }
}

function parseAndNormalize(raw: unknown, format: string): NextResponse {
  // 1. Já é objeto com .cases
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.cases)) return normalizeAndRespond(obj.cases, format);
  }

  // 2. Já é array direto de casos
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
    return normalizeAndRespond(raw as Record<string, unknown>[], format);
  }

  // 3. Converte para string e limpa
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  const cleaned = sanitizeJSON(str.replace(/<think>[\s\S]*?<\/think>/gi, "").trim());

  console.log("[parse] input length:", cleaned.length, "| preview:", cleaned.slice(0, 150));

  // 4. Extrai JSON balanceado e tenta parsear
  let jsonStr: string;
  try {
    jsonStr = extractBalancedJSON(cleaned);
  } catch (e) {
    throw new Error(`Falha ao extrair JSON: ${e}. Preview: ${cleaned.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    // Tenta mais agressivamente: remove tudo antes do primeiro [ ou {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      const arrParsed = tryParseJSON(arrMatch[0]);
      if (Array.isArray(arrParsed)) return normalizeAndRespond(arrParsed as Record<string, unknown>[], format);
    }
    throw new Error(`JSON.parse falhou: ${e}. JSON recebido: ${jsonStr.slice(0, 300)}`);
  }

  // 5. .cases no topo
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.cases)) return normalizeAndRespond(obj.cases, format);
  }

  // 6. parsed é array direto
  if (Array.isArray(parsed) && parsed.length > 0) {
    return normalizeAndRespond(parsed as Record<string, unknown>[], format);
  }

  // 7. Procura {"cases": ...} em qualquer posição
  const idx = cleaned.indexOf('"cases"');
  if (idx !== -1) {
    for (let i = idx - 1; i >= 0; i--) {
      if (cleaned[i] === "{") {
        const inner = extractBalancedJSON(cleaned.slice(i));
        const innerParsed = tryParseJSON(inner);
        if (innerParsed && typeof innerParsed === "object" && Array.isArray((innerParsed as Record<string, unknown>).cases)) {
          return normalizeAndRespond((innerParsed as Record<string, unknown>).cases as Record<string, unknown>[], format);
        }
        break;
      }
    }
  }

  throw new Error(`Não encontrei array de casos. Top-level parsed type: ${typeof parsed}. Preview: ${cleaned.slice(0, 200)}`);
}

function getField(tc: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(tc).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found && tc[found]) return String(tc[found]);
  }
  return "";
}

function normalizeAndRespond(cases: Record<string, unknown>[], format: string): NextResponse {
  const normalized = cases.map((tc, i) => ({
    title: getField(tc, "title", "titulo", "título") || `Caso ${i + 1}`,
    precondition: tc.precondition ?? tc.preCondition ?? null,
    priority: ["HIGH", "MEDIUM", "LOW"].includes(String(tc.priority).toUpperCase())
      ? String(tc.priority).toUpperCase() : "MEDIUM",
    format,
    ...(format === "BDD" ? {
      bddGiven: getField(tc, "bddGiven", "given", "dado"),
      bddWhen:  getField(tc, "bddWhen",  "when",  "quando"),
      bddThen:  getField(tc, "bddThen",  "then",  "entao", "então"),
      notes:    tc.notes ? String(tc.notes) : null,
    } : {
      steps: Array.isArray(tc.steps) ? tc.steps : [],
      expectedResult: getField(tc, "expectedResult", "resultadoEsperado", "resultado"),
      notes: tc.notes ? String(tc.notes) : null,
    }),
  }));

  return NextResponse.json({ cases: normalized, provider: "manus" });
}

// ─── OpenAI-compatible LLM ───────────────────────────────────────────────────

async function generateWithLLM({
  context, quantity, format, language, coverageLevel, testType,
  baseUrl, model, apiKey, providerName,
}: {
  context: string; quantity: number; format: string; language: string;
  coverageLevel: string; testType: string;
  baseUrl: string; model: string; apiKey: string; providerName?: string;
}) {
  const prompt = buildPrompt({ context, quantity, format, language, coverageLevel, testType });

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Você é um analista de QA sênior especialista em casos de teste. Escreva sempre em português brasileiro correto, natural e profissional. Nunca use placeholders, textos genéricos ou informações inventadas. Responda SOMENTE com JSON puro e válido — sem markdown, sem blocos de código, sem nenhum texto fora do JSON.",
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
    const provider = providerName ?? (apiKey === "ollama" ? "ollama" : "openai");
    const result = parseAndNormalize(raw, format);
    const body = await result.json();
    return NextResponse.json({ ...body, model, provider });
  } catch (err) {
    console.error("Erro ao gerar casos:", err);
    throw err;
  }
}

function generateMock({ context, quantity, format }: { context: string; quantity: number; format: string }) {
  const title = context.split("\n")[0]?.replace("Título: ", "") || "Funcionalidade";
  return Array.from({ length: quantity }, (_, i) => {
    if (format === "BDD") {
      return {
        title: `CT-${String(i + 1).padStart(3, "0")} - ${title} - Cenário ${i + 1}`,
        precondition: i === 0 ? "Usuário autenticado no sistema" : null,
        priority: i === 0 ? "HIGH" : i < Math.ceil(quantity / 2) ? "MEDIUM" : "LOW",
        format: "BDD",
        bddGiven: `O usuário está na tela de ${title.toLowerCase()}`,
        bddWhen: `O usuário realiza a ação ${i + 1} em ${title.toLowerCase()}`,
        bddThen: `O sistema deve exibir o resultado esperado para o cenário ${i + 1}`,
      };
    } else {
      return {
        title: `CT-${String(i + 1).padStart(3, "0")} - ${title} - Passo a Passo ${i + 1}`,
        precondition: i === 0 ? "Usuário autenticado no sistema" : null,
        priority: i === 0 ? "HIGH" : i < Math.ceil(quantity / 2) ? "MEDIUM" : "LOW",
        format: "STEP_BY_STEP",
        steps: [
          { order: 1, description: `Acessar a funcionalidade de ${title.toLowerCase()}` },
          { order: 2, description: `Executar a ação ${i + 1}` },
          { order: 3, description: `Verificar o resultado` },
        ],
        expectedResult: `O sistema exibe o resultado esperado corretamente para o cenário ${i + 1}`,
        notes: null,
      };
    }
  });
}
