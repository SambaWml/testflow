# Estrutura — quem faz o quê no TestFlow

Documento para quem quer entender como as peças do sistema se conversam: papel do Next.js vs. React, como o frontend é estilizado, onde fica o backend, como cliente e servidor trocam dados e por que usamos Prisma como ORM.

---

## 1. Visão de alto nível (3 camadas, mas no mesmo processo)

O TestFlow é uma aplicação **Next.js full-stack**. Não existe backend separado — o mesmo processo serve páginas, executa rotas de API e fala com o Postgres.

```
┌────────────────────────────────────────────────────────────────┐
│ Browser (Chrome/Safari/Firefox)                                │
│   • React 19 — Client Components + Server Components           │
│   • TanStack Query v5 — cache e sincronização de estado remoto │
│   • Radix UI + Tailwind 4 — visual e comportamento             │
└──────────────────────────┬─────────────────────────────────────┘
                           │  HTTP (fetch /api/...)
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ Next.js 16 (App Router) — um único processo Node              │
│   • Server Components que rodam SSR                            │
│   • src/proxy.ts — gate de autenticação/autorização           │
│   • src/app/api/**/route.ts — endpoints REST                   │
│   • NextAuth v5 — sessões JWT                                  │
└──────────────────────────┬─────────────────────────────────────┘
                           │  Prisma Client (TCP)
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ PostgreSQL (Supabase)                                          │
│   • Pooler Supavisor :6543 (runtime)                           │
│   • Direct connection :5432 (migrations)                       │
└────────────────────────────────────────────────────────────────┘
```

Não há serviço de backend à parte, não há fila, não há cache (Redis), não há WebSocket. É deliberadamente simples.

---

## 2. Papel do Next.js

O Next.js faz três trabalhos distintos, **cada um em um arquivo diferente**:

### 2.1 Roteamento e render de página
Arquivos `page.tsx`, `layout.tsx`, `loading.tsx` dentro de `src/app/`. App Router — cada pasta é um segmento de URL.

- `src/app/layout.tsx` — `<html>`, `<body>`, injeta `<Providers>` (contextos globais).
- `src/app/(dashboard)/layout.tsx` — desenha a `Sidebar` e o `<main>`.
- `src/app/(dashboard)/page.tsx` — a página raiz `/` (dashboard).
- Grupos `(auth)` e `(dashboard)` existem só para compartilhar layout sem poluir a URL.

### 2.2 Gate de autenticação/autorização (`src/proxy.ts`)
Em Next 16 o "middleware" foi renomeado para **proxy**. O arquivo `src/proxy.ts` roda antes de toda request (salvo assets estáticos) e:
- Bloqueia tudo sem sessão — JSON 401 para `/api/*`, redirect `/login` para páginas.
- Redireciona super admins para `/admin` se tentarem entrar em rotas de org.
- Manda usuários sem org para `/pending`.
- Bloqueia `/settings/members` e `/settings/projects` para MEMBER/VIEWER.

```ts
// src/proxy.ts (trecho)
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  if (!session?.user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  // ... regras de super admin, org role, settings
});
```

### 2.3 Endpoints de API (`src/app/api/**/route.ts`)
Cada arquivo `route.ts` exporta funções `GET`, `POST`, `PATCH`, `DELETE` que recebem `Request` e devolvem `Response` (ou `NextResponse`). É o nosso "backend".

Exemplo (simplificado) `src/app/api/orgs/members/route.ts`:

```ts
export async function POST(req: NextRequest) {
  const session = await auth();                                          // NextAuth server-side
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);                                    // extrai orgId, orgRole, isSuperAdmin
  if (u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") return NextResponse.json({ error }, { status: 403 });

  const { name, email, role } = await req.json();
  // ... cria user + orgMember via Prisma, envia e-mail
  return NextResponse.json({ user, isNewUser, emailSent });
}
```

### Resumindo o papel do Next

| Responsabilidade | Onde |
|---|---|
| Roteamento de páginas | estrutura de pastas em `src/app/` |
| Server-Side Rendering e Streaming | automático em Server Components |
| Gate de segurança | `src/proxy.ts` |
| Backend HTTP | `src/app/api/**/route.ts` |
| Bundling/TS/JSX/CSS | build do Next (`npm run build`) |

---

## 3. Papel do React

Dentro das páginas que o Next renderiza, quem desenha UI é o React 19. Duas categorias de componente convivem:

### 3.1 Server Components (padrão)
Rodam **só no servidor**, não vão para o bundle do cliente. Sem `useState`, sem `useEffect`. Podem chamar Prisma direto. Ótimos para telas que só listam dados.

### 3.2 Client Components (`"use client"`)
Rodam no navegador, reagem a interação. Usam hooks (`useState`, `useQuery`, etc.). Todos os componentes em `src/components/layout/`, `src/components/cases/`, `src/components/ui/` e as páginas interativas (dashboard, generator, executions) são client components.

Exemplo — `src/components/providers.tsx`:

```tsx
"use client";
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
  }));
  return (
    <SessionProvider>
      <ThemeProvider>
        <LangProvider>
          <TermsProvider>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            </QueryClientProvider>
          </TermsProvider>
        </LangProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
```

### React 19 — novidades usadas no projeto
- **`use(params)`** em páginas client cujo `params` vem como `Promise` (exigência do Next 15+).
- **Server Components + `async/await` direto na função de página** — a maioria das listagens server-rendered faz `await prisma.x.findMany(...)` no próprio componente.

---

## 4. Estilização — Tailwind 4 + Radix + shadcn

### 4.1 Tailwind 4
- Pacote: `tailwindcss ^4` + `@tailwindcss/postcss`.
- Não há `tailwind.config.js` clássico — configuração é feita via `src/app/globals.css` e o plugin do PostCSS.
- Dark mode via `class="dark"` no `<html>`, aplicado antes do primeiro paint por um inline `<script>` em `src/app/layout.tsx` para evitar flash.

### 4.2 Radix UI (primitivos headless)
Todos os componentes interativos são construídos sobre Radix: Dialog, DropdownMenu, Popover, Tabs, Tooltip, Select, Accordion, Checkbox, RadioGroup, Switch, Toast, ScrollArea, Separator, Label.

Os wrappers ficam em `src/components/ui/*.tsx` (padrão shadcn). Você raramente importa Radix direto — sempre `@/components/ui/dialog`, `@/components/ui/button`, etc.

### 4.3 Utilitários `cn` + `cva`
```ts
// src/lib/utils.ts (simplificado)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

- `cn(...)` resolve classes condicionais (`clsx`) e dedupe tailwind (`tailwind-merge`).
- `class-variance-authority` (`cva`) define variantes tipadas dos componentes (`button` tem `variant` e `size`).

### 4.4 Ícones
`lucide-react` — todos os ícones do app vêm dele. Sempre 16px ou 20px, cor herdada via `currentColor`.

### 4.5 Gráficos
Recharts, usado em `src/app/(dashboard)/page.tsx` e subpáginas do Dashboard QA. Pie chart de status e bar chart de distribuição por membro/projeto.

---

## 5. Onde fica o "backend"

O backend é o próprio Next.js, dividido em:

### 5.1 Rotas de API (`src/app/api/**/route.ts`)

Um por recurso. Cada arquivo exporta uma função por verbo HTTP. A convenção invariável é:

```ts
export async function GET(request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  const { id } = await params;

  // Isolamento multi-tenant — padrão obrigatório
  const where = u.isSuperAdmin ? { id } : { id, organizationId: u.orgId! };
  const resource = await prisma.project.findFirst({ where });
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ resource });
}
```

### 5.2 Camada `src/lib/` — lógica compartilhada

- **`prisma.ts`** — singleton do cliente Prisma.
- **`auth.ts`** — exporta `handlers`, `auth`, `signIn`, `signOut` do NextAuth.
- **`permissions.ts`** — `sessionUser()`, `getProjectsForUser()`, `getLinkedProjects()`.
- **`ai-config.ts`** — lê/escreve config de IA no `Setting`.
- **`email.ts`** — Nodemailer com 2 templates (welcome, password reset).
- **`i18n.ts`, `term-config.ts`, `enum-config.ts`** — mensagens e enums.
- **`openapi.ts`** — gera o spec OpenAPI servido em `/api-docs`.

### 5.3 Autenticação

Arquivo único — `src/lib/auth.ts`:
```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Credentials({
    async authorize(credentials) {
      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
        include: { orgMembers: { include: { organization: true } } },
      });
      if (!user?.passwordHash) return null;
      const valid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!valid) return null;
      const firstMember = user.orgMembers[0] ?? null;
      return {
        id: user.id, name: user.name, email: user.email,
        role: user.role, isSuperAdmin: user.isSuperAdmin,
        orgId: firstMember?.organizationId ?? null,
        orgRole: firstMember?.role ?? null,
      };
    },
  })],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) Object.assign(token, { id: user.id, ..., orgId: user.orgId, orgRole: user.orgRole });
      if (trigger === "update" && session?.name) token.name = session.name;
      return token;
    },
    session({ session, token }) {
      if (token) Object.assign(session.user, { id: token.id, orgId: token.orgId, orgRole: token.orgRole, ... });
      return session;
    },
  },
});
```

O handler HTTP (`/api/auth/[...nextauth]`) é só:
```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

---

## 6. Como cliente e servidor conversam

### 6.1 Rota pura (Server Component) — sem cliente

Muitas páginas simples fazem SSR puro:

```tsx
// Exemplo hipotético — Server Component
export default async function Page() {
  const session = await auth();
  const projects = await prisma.project.findMany({ where: { organizationId: session.user.orgId } });
  return <ul>{projects.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

O HTML já vai com os dados — nada é chamado no navegador depois.

### 6.2 Client Component com TanStack Query — padrão dominante

A maioria das telas interativas usa `useQuery`/`useMutation`:

```tsx
"use client";
const { data, isLoading } = useQuery({
  queryKey: ["members"],
  queryFn: () => fetch("/api/orgs/members").then(r => r.json()),
});

const mutation = useMutation({
  mutationFn: (payload) => fetch("/api/orgs/members", { method: "POST", body: JSON.stringify(payload) }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
});
```

Configuração global em `src/components/providers.tsx`:
- `staleTime: 60_000` — dados considerados frescos por 1 min.
- `retry: 1` — uma retry antes de marcar erro.

> Atenção: TanStack Query **v5** removeu `onSuccess`/`onError` de `useQuery`. Esses callbacks só existem em `useMutation`. Para reagir a dados novos em queries, use `useEffect` monitorando `data`.

### 6.3 Uploads (`/api/upload`)
Arquivos viram `FormData` no cliente, POST multipart → a rota escreve em `uploads/` e devolve uma URL `/api/uploads/[filename]` (download autenticado).

### 6.4 Download de PDF (`/api/reports/[id]/pdf`)
Rota gera o PDF com `@react-pdf/renderer` e devolve binário com `Content-Disposition: attachment`. O cliente só faz `window.open(url)`.

---

## 7. Prisma — por que e como

### 7.1 Por que Prisma
Três razões pragmáticas:

1. **Modelo único de verdade** — `prisma/schema.prisma` descreve as tabelas, relações e defaults em um arquivo. O time lê isso em 30 segundos.
2. **Tipos gerados automaticamente** — toda query Prisma já devolve o tipo certo, sem precisar manter interfaces paralelas. Quebra de schema vira erro de TypeScript no código que a usa.
3. **Migrations versionadas** — cada mudança vira um arquivo SQL em `prisma/migrations/YYYYMMDDhhmmss_nome/`. Roda em ordem em qualquer ambiente.

### 7.2 Papel do Prisma na arquitetura

Camada fina entre o código TypeScript e o Postgres. Não é um repositório nem um domain layer — é um **query builder tipado**. Toda regra de negócio (quem pode ver o quê, quem pode editar o quê) **fica nas rotas de API**, não no Prisma.

```
┌──────────────────────┐    ┌─────────────┐    ┌────────────┐
│ route.ts (negócio)   │───▶│  Prisma ORM │───▶│ PostgreSQL │
│  • valida sessão     │    │  • types    │    │            │
│  • filtra por orgId  │    │  • migrations│   │            │
│  • compõe where/data │    └─────────────┘    └────────────┘
└──────────────────────┘
```

### 7.3 Singleton com adapter pg

```ts
// src/lib/prisma.ts
function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: url.includes("supabase.com") ? { rejectUnauthorized: false } : false,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Por que singleton no global: em dev o Next recarrega módulos em cada edição, o que criaria conexões vazando no Postgres. O truque do `globalForPrisma` mantém uma única instância por processo.

### 7.4 Duas URLs — pooler para runtime, direct para migrations

| Variável | Porta | Uso | Por quê |
|---|---|---|---|
| `DATABASE_URL` | 6543 | Runtime (queries) | Supavisor faz pooling — essencial em serverless. |
| `DIRECT_URL` | 5432 | Migrations | Supavisor rejeita DDL; precisa conexão direta. |

O `prisma.config.ts` força migrations a usar `DIRECT_URL`. Tentar rodar migration contra o pooler dá erro de "prepared statement already exists".

### 7.5 Como trabalhar com Prisma no dia a dia

**Editar schema:**
```prisma
// prisma/schema.prisma — adicionar campo
model TestCase {
  // ... campos existentes
  automatedById String?       // novo
  automatedBy   User?   @relation(...)
}
```

**Criar migration em dev:**
```bash
npx prisma migrate dev --name add_automated_by
```
Isso cria `prisma/migrations/20260423xxxxxx_add_automated_by/migration.sql`, aplica no banco de dev, regenera o client.

**Queries padrão no projeto:**

```ts
// Listar (com filtro multi-tenant + projeto)
const cases = await prisma.testCase.findMany({
  where: {
    organizationId: u.orgId!,
    ...(projectIdFilter ? { projectId: { in: projectIdFilter } } : {}),
    isActive: true,
  },
  include: { steps: { orderBy: { order: "asc" } }, author: { select: { name: true } } },
  orderBy: { updatedAt: "desc" },
});

// Get por id — NUNCA findUnique, sempre findFirst com orgId
const testCase = await prisma.testCase.findFirst({
  where: u.isSuperAdmin ? { id } : { id, organizationId: u.orgId! },
});
if (!testCase) return NextResponse.json({ error: "Not found" }, { status: 404 });

// Criar com transação (ex: plano + itens)
await prisma.$transaction(async (tx) => {
  const plan = await tx.testPlan.create({ data: { ... } });
  await tx.testPlanCase.createMany({ data: caseIds.map((id, i) => ({ testPlanId: plan.id, caseId: id, order: i })) });
  return plan;
});
```

**Regras do projeto (documentadas em `AGENTS.md`):**
- Nunca `findUnique` em rota `[id]` com org.
- 404 (nunca 403) para recurso de outra org.
- Soft delete em `TestCase` (`isActive: false`), nunca `DELETE`.
- `version` em `TestCase` é incrementado no PATCH — não mexer manualmente.
- Migrations sempre via `migrate dev` (desenvolvimento) ou `migrate deploy` (produção). **Nunca `db push`** em banco compartilhado.

### 7.6 Tipos derivados (sem DTOs à mão)

```ts
import type { TestCase, TestStep } from "@prisma/client";
type CaseWithSteps = TestCase & { steps: TestStep[] };

// Ou inferido de uma query específica:
const caseQuery = Prisma.validator<Prisma.TestCaseDefaultArgs>()({
  include: { steps: true, author: { select: { name: true } } },
});
type CaseFull = Prisma.TestCaseGetPayload<typeof caseQuery>;
```

Na prática o projeto quase sempre faz o cast inline no `fetch().then(r => r.json() as Promise<{ cases: TestCase[] }>)` — é pragmático, mas expõe o risco de divergência quando a API retorna um shape derivado.

---

## 8. Fluxos concretos — juntando tudo

### 8.1 Listar os casos do projeto

1. Usuário abre `/cases?projectId=xxx` → página client.
2. `useQuery(["cases", projectId], () => fetch(`/api/cases?projectId=${projectId}`).then(r => r.json()))`.
3. `src/proxy.ts` deixa passar (user tem sessão e orgId).
4. `src/app/api/cases/route.ts`:
   - `session = await auth()` → valida sessão.
   - `u = sessionUser(session.user)` → pega orgId/orgRole.
   - `projectIds = await getProjectsForUser(u.id, u.orgId, u.orgRole)` → `null` para OWNER/ADMIN.
   - `prisma.testCase.findMany({ where: { organizationId: u.orgId, isActive: true, ...(projectIds ? { projectId: { in: projectIds } } : {}) } })`.
5. JSON volta → TanStack Query guarda em cache → componente renderiza lista.

### 8.2 Convidar um membro

1. Owner clica "Convidar" em `/settings/members`.
2. `useMutation` dispara `POST /api/orgs/members` com `{ name, email, role }`.
3. Rota valida: sessão → `u.orgRole ∈ {OWNER, ADMIN}` → não é membro duplicado.
4. `prisma.$transaction`: cria `User` se não existir, cria `OrgMember`.
5. Envia `sendWelcomeEmail` (Nodemailer). Se falhar, devolve `tempPassword` no JSON.
6. `onSuccess` invalida `queryKey: ["members"]` → lista re-renderiza.

### 8.3 Gerar casos de teste via IA

1. Usuário descreve o item em `/generator`, seleciona quantidade/formato/cobertura, clica **Gerar**.
2. `POST /api/cases/generate` com payload.
3. Rota:
   - `await getAIConfig()` retorna `{ activeProvider: "claude", claude: { apiKey, model } }`.
   - Monta prompt dependendo de `format`/`language`/`testType`.
   - Chama Anthropic (`fetch POST /messages`), OpenAI (`/chat/completions`), ou cria task Manus e faz polling até 5 min.
   - Sanitiza JSON (remove trailing commas, extrai JSON balanceado).
   - Grava `GenerationLog` para auditoria.
   - Devolve `{ cases: [...] }`.
4. Cliente mostra casos gerados em modo preview; usuário revisa, edita e confirma. Só aí são salvos em `TestCase` via `POST /api/cases/bulk`.

---

## 9. Decisões que moldam o dia-a-dia

| Decisão | Consequência |
|---|---|
| App Router (não Pages Router) | Layouts compostos, Server Components por padrão, `params` é Promise. |
| NextAuth JWT (não `@auth/prisma-adapter` ativo) | Não há `Session` em banco — menos queries, mas mudanças de `orgRole` só aparecem no próximo login. |
| Supabase com duas URLs | Cada ambiente precisa de duas envs (pooler + direct), migration só na direct. |
| Multi-tenant por `organizationId` (RLS opcional) | Todas as queries filtram manualmente; não confiar no banco. |
| 404 em vez de 403 para recursos de outra org | Não vaza existência. |
| Provedor de IA em `Setting` + fallback env | Super admin troca provedor sem deploy. |
| Terms/theme/lang em `localStorage` | Zero estado no servidor para UI customization, mas troca de device começa nas defaults. |
| Tailwind 4 + Radix + shadcn | Zero CSS-in-JS; componentes com classes utilitárias; dark mode por classe. |
| TanStack Query no cliente | Padrão dominante — não há fetch ad-hoc em componentes sem cache. |

---

## 10. Onde procurar quando for mexer

| Preciso mudar… | Arquivo-chave |
|---|---|
| Uma tela | `src/app/(dashboard)/<rota>/page.tsx` |
| Um endpoint | `src/app/api/<recurso>/route.ts` |
| O modelo de dados | `prisma/schema.prisma` + nova migration |
| Quem pode fazer o quê | `src/lib/permissions.ts` + chequagens em cada rota |
| Layout / nav | `src/components/layout/sidebar.tsx`, `topbar.tsx` |
| Um componente visual genérico | `src/components/ui/*.tsx` |
| Textos / tradução | `src/lib/i18n.ts` |
| Termos customizáveis | `src/lib/term-config.ts` |
| Provedor IA | `src/lib/ai-config.ts` + `/admin/ai` |
| E-mail | `src/lib/email.ts` |
| Gate de rotas | `src/proxy.ts` |
| Build / deploy | `next.config.ts`, `vercel.json`, `DEPLOY.md` |
| Schema OpenAPI | `src/lib/openapi.ts` + rota `/api-docs` |

Próximo documento: `docs/04-features.md` — o que cada feature faz, quais roles enxergam o quê, e o workflow de criação de workspace e membros.
