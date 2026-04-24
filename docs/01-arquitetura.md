# Arquitetura — TestFlow

Documento de referência para onboarding de novos desenvolvedores. Descreve o que é o projeto, quais tecnologias estão em uso, em quais versões, por que foram escolhidas e como a base de código está organizada em pastas.

---

## 1. O que é o TestFlow

Plataforma web **multi-tenant** (SaaS) para gestão de testes de software. Cada organização ("workspace") tem seus dados completamente isolados — usuários pertencem a uma ou mais organizações com papéis distintos. O sistema cobre o ciclo completo de QA:

- Organização do trabalho em **projetos** e **módulos**.
- Cadastro de **itens** (user stories, bugs, requisitos) que viram insumos para geração de testes.
- Geração de **casos de teste** (BDD ou passo-a-passo) via integração com LLMs.
- Montagem de **planos de teste** (coleções de casos).
- Registro de **execuções** com status, evidências (arquivos/URLs) e bugs relacionados.
- Consolidação em **relatórios** exportáveis para PDF.
- Painel de **super administração** para criar organizações, gerenciar super admins e configurar o provedor de IA global.

Existe também uma camada de **personalização por organização**: nomes de papéis, terminologia (12+ termos como "Projeto", "Bug", "Caso de Teste") e quais dashboards estão ativos.

---

## 2. Stack — camada a camada

| Camada | Tecnologia | Versão (package.json) | Observação |
|---|---|---|---|
| Framework | Next.js (App Router) | `16.2.2` | Breaking changes em relação a 14/15 — consultar `node_modules/next/dist/docs/` antes de editar código de framework. |
| Runtime React | React + React DOM | `19.2.4` | Server Components + Client Components. Usa `use(params)` em páginas client (Next 15+ deixou `params` como Promise). |
| Linguagem | TypeScript | `^5` | `strict: true` no `tsconfig.json`, `moduleResolution: "bundler"`, path alias `@/*` → `./src/*`. |
| ORM | Prisma | `^7.7.0` | Cliente + `@prisma/client`. Provider `postgresql`. Usa adapter (`@prisma/adapter-pg`) com `pg.Pool`. |
| Driver PG | pg | `^8.20.0` | Pool de conexão com SSL auto-ativado para hosts `supabase.com`. |
| Banco | PostgreSQL (Supabase) | — | Em produção o schema roda no Supabase; há também um `dev.db` (SQLite legado, não usado pelo código atual). |
| Auth | NextAuth | `^5.0.0-beta.30` | Strategy `jwt`, provider `credentials` (email + senha + `bcrypt.compare`). `@auth/prisma-adapter` instalado. |
| Hashing | bcryptjs | `^3.0.3` | 10 rounds no seed; 12 rounds ao criar/redefinir senhas em produção. |
| UI primitives | Radix UI | `^1.x / ^2.x` | `@radix-ui/react-*` — base para todos os componentes headless. |
| Estilização | Tailwind CSS | `^4` | Tailwind 4 com PostCSS (`@tailwindcss/postcss`). Sem config clássica `tailwind.config.js`. |
| Utilitários de estilo | `clsx`, `tailwind-merge`, `class-variance-authority` | — | Padrão shadcn/ui para variantes de componente. |
| Ícones | lucide-react | `^1.7.0` | Todos os ícones do app. |
| Estado servidor | TanStack Query | `^5.96.2` | `QueryClientProvider` em `src/components/providers.tsx`, `staleTime: 60s`, `retry: 1`. |
| Estado global client | Zustand | `^5.0.12` | Disponível mas pouco usado — prevalece TanStack Query + contextos. |
| Formulários | React Hook Form + Zod | `^7.72.1` / `^4.3.6` | Resolvers via `@hookform/resolvers`. |
| Gráficos | Recharts | `^3.8.1` | Usado no dashboard (pie, bar). |
| PDF | @react-pdf/renderer | `^4.4.0` | Exporta relatórios em `/api/reports/[id]/pdf`. |
| E-mail | Nodemailer | `^7.0.13` | SMTP para convites e reset de senha (`src/lib/email.ts`). |
| SDKs de IA | OpenAI SDK + `ai` (Vercel AI) | `^6.33.0` / `^6.0.154` | Suporta também Manus AI (endpoint HTTP-compatible) e Claude (Anthropic) direto via fetch. |
| IDs | uuid, cuid | `^13.0.0` (uuid) | Prisma gera IDs via `@default(cuid())`. |
| Datas | date-fns | `^4.1.0` | Formatação com locale configurável. |
| Lint | ESLint | `^9` | Flat config em `eslint.config.mjs`, usa `eslint-config-next`. |
| Runner TS | tsx | `^4.21.0` | Para rodar `prisma/seed.ts` (`npm run seed`). |

**O que não está em uso** (apesar de instalado):
- `@libsql/client` + `@prisma/adapter-libsql` — legado de quando o banco era Turso/SQLite. Hoje só `@prisma/adapter-pg` é carregado em `src/lib/prisma.ts`.
- `dev.db` na raiz — SQLite antigo, não lido pelo runtime.

---

## 3. Estrutura de pastas

```
testflow/
├── prisma/
│   ├── schema.prisma            # modelo de dados único e fonte da verdade
│   ├── migrations/              # 8 migrations aplicadas (init + evolução da org)
│   └── seed.ts                  # cria super admin + org demo + dados de exemplo
├── prisma.config.ts             # aponta migrations para DIRECT_URL (porta 5432)
├── public/                      # SVGs estáticos
├── uploads/                     # arquivos de evidência (local — não persiste em serverless)
├── src/
│   ├── app/                     # App Router (Next.js 16)
│   │   ├── layout.tsx           # RootLayout + <Providers>
│   │   ├── globals.css          # Tailwind base + tokens (dark/light)
│   │   ├── (auth)/
│   │   │   └── login/           # tela de login (público)
│   │   ├── (dashboard)/         # rotas autenticadas da organização
│   │   │   ├── layout.tsx       # Sidebar + <main>
│   │   │   ├── page.tsx         # Dashboard (Visão Geral + Dashboard QA)
│   │   │   ├── projects/        # gestão de projetos e itens (user stories, bugs…)
│   │   │   ├── items/           # detalhe de items
│   │   │   ├── cases/           # biblioteca de casos de teste
│   │   │   ├── generator/       # gerador IA (casos + bugs)
│   │   │   │   └── bugs/
│   │   │   ├── executions/      # execução de planos caso a caso
│   │   │   ├── reports/         # listagem + geração de relatórios
│   │   │   ├── bugs/            # tracker simples de bugs
│   │   │   └── settings/
│   │   │       ├── general/
│   │   │       ├── dashboards/  # (ownerOnly) toggle/rename dashboards
│   │   │       ├── terms/       # (ownerOnly) renomeia os 12+ termos do sistema
│   │   │       ├── members/     # (owner/admin) convidar/remover membros
│   │   │       ├── projects/    # (owner/admin) CRUD de projetos da org
│   │   │       ├── generator/   # status do provedor IA
│   │   │       └── about/       # glossário e tech stack
│   │   ├── admin/               # Super Admin — fora da org
│   │   │   ├── page.tsx         # lista de organizações
│   │   │   ├── orgs/[id]/       # detalhe + membros de uma org
│   │   │   ├── admins/          # super admins da plataforma
│   │   │   └── ai/              # configuração do provedor IA global
│   │   ├── pending/             # usuário logado que não pertence a nenhuma org
│   │   ├── api-docs/            # Swagger UI
│   │   └── api/                 # endpoints REST (ver seção 4)
│   ├── components/
│   │   ├── providers.tsx        # SessionProvider + Theme + Lang + Terms + QueryClient + Tooltip
│   │   ├── layout/
│   │   │   ├── sidebar.tsx      # navegação principal
│   │   │   └── topbar.tsx       # título da página + dropdown de perfil
│   │   ├── cases/               # dialogs de criação/edição de caso
│   │   └── ui/                  # primitivos shadcn (button, dialog, select, …)
│   ├── contexts/
│   │   ├── lang-context.tsx     # pt-BR / en-US com localStorage
│   │   ├── terms-context.tsx    # termos customizáveis por idioma
│   │   └── theme-context.tsx    # dark / light com localStorage
│   ├── lib/
│   │   ├── prisma.ts            # singleton do cliente Prisma + adapter pg
│   │   ├── auth.ts              # NextAuth handlers + callbacks (jwt, session)
│   │   ├── permissions.ts       # sessionUser() + getProjectsForUser() + getLinkedProjects()
│   │   ├── ai-config.ts         # leitura/escrita de Setting(ai_provider_config)
│   │   ├── email.ts             # Nodemailer (sendWelcomeEmail, sendPasswordResetEmail)
│   │   ├── i18n.ts              # dicionário pt-BR / en-US
│   │   ├── term-config.ts       # tipos e defaults dos termos + helpers localStorage
│   │   ├── enum-config.ts       # enums de status / prioridade / formato
│   │   ├── openapi.ts           # gera o spec OpenAPI 3.0 servido em /api-docs
│   │   └── utils.ts             # cn() e utilitários pequenos
│   └── proxy.ts                 # "middleware" do Next 16 — gate de autenticação/autorização
├── CLAUDE.md, AGENTS.md         # instruções para agentes de IA (padrões obrigatórios do projeto)
├── README.md, DEPLOY.md         # guias para humanos
├── eslint.config.mjs, tsconfig.json, postcss.config.mjs, next.config.ts
└── vercel.json                  # configuração de deploy na Vercel
```

### Convenções do App Router em uso

- **Grupos de rota com parênteses** — `(auth)` e `(dashboard)` não aparecem na URL, servem só para compartilhar layout.
- **Params assíncronos** (Next 15+) — toda rota `[id]` tipa `params: Promise<{ id: string }>` e faz `await params` em server code ou `use(params)` em client components.
- **Middleware renomeado** — em Next 16 o arquivo é `src/proxy.ts` exportando `proxy` (não `src/middleware.ts`).

---

## 4. Superfície de API (REST)

Todas as rotas ficam em `src/app/api/` organizadas por recurso. Convenção:

| Padrão | Onde |
|---|---|
| Autenticação | `/api/auth/[...nextauth]` (NextAuth) |
| Recurso da organização corrente | `/api/orgs/*` (members, projects, features, role-names) |
| Recurso do super admin | `/api/admin/*` (orgs, superadmins) |
| CRUD de domínio | `/api/projects`, `/api/cases`, `/api/items`, `/api/executions`, `/api/test-plans`, `/api/reports`, `/api/bugs` |
| Geração por IA | `/api/cases/generate`, `/api/bugs/generate` |
| Operações em lote | `/api/cases/bulk`, `/api/bugs/bulk` |
| Upload de arquivos | `/api/upload`, `/api/uploads/[filename]` (download), `/api/evidence` |
| Config do provedor IA | `/api/settings/ai`, `/api/ai-status` |
| PDF | `/api/reports/[id]/pdf` |
| Spec OpenAPI | `/api/docs` — renderizado pelo Swagger UI em `/api-docs` |

Status HTTP padronizados (ver `AGENTS.md`):
- `401` sem sessão
- `403` sem papel suficiente (ex.: MEMBER tentando convidar)
- `404` recurso inexistente **ou de outra org** (padrão IDOR — nunca confirma existência)
- `409` conflito de negócio
- `201` criação bem-sucedida

---

## 5. Decisões arquiteturais importantes

### 5.1 Prisma + Supabase — duas URLs

`src/lib/prisma.ts` usa `DATABASE_URL` (pooler do Supabase, porta **6543**, aceita queries). `prisma.config.ts` usa `DIRECT_URL` (conexão direta, porta **5432**, aceita DDL). Migrations **sempre** contra `DIRECT_URL`; o pooler Supavisor rejeita `CREATE/ALTER TABLE`.

```ts
// src/lib/prisma.ts (runtime)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: url.includes("supabase.com") ? { rejectUnauthorized: false } : false,
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

```ts
// prisma.config.ts (migrations)
datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" }
```

### 5.2 Isolamento multi-tenant por `organizationId`

Todo modelo de domínio (Project, Item, TestCase, Execution, TestPlan, Report) tem `organizationId`. Toda query filtra por ele. **Nunca use `findUnique({ where: { id } })`** em recursos com org — use `findFirst({ where: { id, organizationId } })`. Recursos de outra org retornam **404**, nunca 403 (política anti-IDOR documentada em `AGENTS.md`).

### 5.3 Duas camadas de permissão

1. **Org role** (`OrgMember.role`): `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.
2. **Project role** (`ProjectMember.role`): restringe visibilidade para `MEMBER`/`VIEWER`.

`getProjectsForUser(userId, orgId, orgRole)` em `src/lib/permissions.ts`:
- retorna `null` para OWNER/ADMIN (significa "sem filtro de projeto")
- retorna `string[]` com os IDs visíveis para MEMBER/VIEWER

### 5.4 Super Admin ortogonal à org

`User.isSuperAdmin: boolean` é independente de `OrgMember`. O `proxy.ts` redireciona super admins para `/admin` se tentarem entrar nas rotas de organização, e para `/login` → `/admin` no login. Super admin usa **apenas** o painel global.

### 5.5 JWT session carrega contexto da org

NextAuth v5, strategy `jwt`. No callback `authorize`, pega o **primeiro `OrgMember`** do usuário e embute no token:

```ts
return {
  id: user.id, name: user.name, email: user.email,
  role: user.role, isSuperAdmin: user.isSuperAdmin,
  orgId: firstMember?.organizationId ?? null,
  orgRole: firstMember?.role ?? null,
};
```

Efeito colateral: usuários multi-org sempre caem na "primeira" org vista pelo Prisma — não há UI atual para trocar de org logado.

### 5.6 Provedor de IA com fallback em cascata

`src/lib/ai-config.ts` lê um `Setting` singleton (`key = "ai_provider_config"`). Se a linha não existir, monta a config a partir das env vars (`ANTHROPIC_API_KEY` → `MANUS_API_KEY` → `OPENAI_API_KEY`, nessa ordem de prioridade). Sem provider e sem keys o gerador devolve casos mockados — **não lança erro** (preservar essa lógica ao mexer no gerador).

### 5.7 Personalização por org

- `Organization.roleNames` — JSON string (`{"OWNER":"Owner","ADMIN":"Admin","MEMBER":"Membro"}`) customizável.
- `Organization.overviewEnabled / overviewName / qaDashboardEnabled / qaDashboardName` — feature flags por tenant.
- Termos de UI (12+ chaves) — armazenados em `localStorage` por idioma (não vão para o servidor).

---

## 6. Modelo de dados (resumo)

Relacionamentos principais (todos em `prisma/schema.prisma`):

```
Organization 1──* OrgMember *──1 User
Organization 1──* Project   1──* ProjectMember *──1 User
Project      1──* Module
Project      1──* Item      1──* TestCase
TestCase     1──* TestStep
TestCase     1──* Execution *──1 User (executor)
TestPlan     1──* TestPlanCase *──1 TestCase
Execution    1──* Evidence
Report       1──* ReportItem *──1 Execution
Setting           (singleton por chave — AI config, etc.)
GenerationLog     (trilha de auditoria da IA)
```

Particularidades:
- `TestCase` usa **soft delete** via `isActive: Boolean` — nunca apague hard.
- `TestCase.version: Int` incrementa automaticamente no PATCH; não mexer manualmente.
- `Organization.code: Int @unique` — código sequencial começando em 1001.
- `Organization.roleNames / members[skills] / plans / tags / metadata` — strings com JSON embutido (legado de SQLite; não mudou para tipo `Json` nativo).

---

## 7. Fluxo de uma request típica

1. **Navegador** → rota Next.
2. **`src/proxy.ts`** intercepta: checa sessão NextAuth, aplica regras de super admin / org / settings.
3. **Layout** (`app/(dashboard)/layout.tsx`) renderiza `Sidebar` + `main` (Server Component).
4. **Página** client ou server chama `fetch("/api/…")`.
5. **Rota de API** (`src/app/api/.../route.ts`):
   - `const session = await auth()` — NextAuth server-side.
   - `const u = sessionUser(session.user)` — extrai id/orgId/orgRole/isSuperAdmin.
   - Monta `where` com `organizationId: u.orgId` (ou bypass para super admin).
   - Aplica `getProjectsForUser` se precisa filtrar por projeto.
   - Chama Prisma → responde JSON.
6. **Cliente** recebe via TanStack Query (`useQuery` / `useMutation`) e renderiza.

---

## 8. O que NÃO está no projeto (armadilhas comuns)

- **Sem test runner**: nenhum `npm test`. Specs Playwright eram planejadas (`tests/e2e/`) mas não há código de teste commitado na árvore atual.
- **Sem Stripe / billing**: campo `plan` é só uma string (`FREE`/`PRO`/…), sem integração de cobrança.
- **Sem realtime / WebSockets**: notificações seriam por polling (60s); ver `AGENTS.md` — "não criar WebSocket".
- **Uploads locais**: `uploads/` é disco local. Em Vercel/serverless isso não persiste — deploy em produção exige bucket externo (R2/S3/Supabase Storage). Ver `DEPLOY.md`.
- **Sem i18n server-side**: traduções são client (`useLang()`), rotas de API respondem sempre em português.

---

## 9. Referências cruzadas

- Instruções obrigatórias para código novo → `AGENTS.md` e `CLAUDE.md`.
- Como rodar o projeto local → `docs/02-setup.md`.
- Quem faz o quê (Next vs React vs Prisma) → `docs/03-estrutura.md`.
- Features, permissões e workflows → `docs/04-features.md`.
- Guia de deploy em produção (Vercel/Supabase/Railway/VPS) → `DEPLOY.md`.
