# TestFlow — Guia para o Agente

## O que é este projeto

Plataforma SaaS **multi-tenant** de gerenciamento de testes de software. Cada organização tem dados completamente isolados. Usuários pertencem a uma org e têm papéis (OWNER / ADMIN / MEMBER) que controlam o que podem ver e fazer.

Documentação técnica completa em [SYSTEM.md](SYSTEM.md). Guia de deploy em [DEPLOY.md](DEPLOY.md).

---

## Stack — o que está em uso

- **Next.js 16** App Router com React 19. Leia `node_modules/next/dist/docs/` antes de escrever código — esta versão tem breaking changes em relação ao treinamento.
- **TypeScript 5** estrito em todo o projeto.
- **Prisma 7** com PostgreSQL (Supabase). Provider sempre `postgresql`.
- **NextAuth v5 beta** com estratégia JWT e provider credentials.
- **TanStack Query v5** para estado servidor no cliente — use `useQuery` / `useMutation`.
- **Tailwind CSS 4** + Radix UI + `shadcn/ui` para componentes.

---

## Padrões obrigatórios

### Autenticação em toda rota de API

```ts
const session = await auth();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const u = sessionUser(session.user);
```

### Isolamento multi-tenant — NUNCA use `findUnique` em recursos com org

Use `findFirst` com o filtro de org para evitar IDOR:

```ts
// ERRADO
prisma.project.findUnique({ where: { id } })

// CERTO
const where = u.isSuperAdmin ? { id } : { id, organizationId: u.orgId! };
prisma.project.findFirst({ where })
```

Recursos de outra org sempre retornam **404** (nunca 403) — não confirmar existência.

### Permissões por papel

- `u.isSuperAdmin` → bypass total de org
- `u.orgRole === "OWNER" || "ADMIN"` → acesso a todos os projetos da org
- `u.orgRole === "MEMBER"` → só projetos em `ProjectMember` (use `getProjectsForUser`)

#### Matrix completa de permissões por rota

| Rota | SUPER ADMIN | OWNER | ADMIN | MEMBER |
|------|:-----------:|:-----:|:-----:|:------:|
| **Projetos** | | | | |
| `GET /api/projects` | todos (todas as orgs) | todos da org | todos da org | só os vinculados |
| `POST /api/projects` | ✅ | ✅ | ✅ | ❌ 403 |
| `GET /api/projects/[id]` | ✅ | ✅ | ✅ | só se vinculado |
| `PATCH /api/projects/[id]` | ✅ | ✅ | ✅ | ❌ 403 |
| `DELETE /api/projects/[id]` | ✅ | ✅ | ✅ | ❌ 403 |
| `GET /api/projects/[id]/modules` | ✅ | ✅ | ✅ | só se vinculado |
| `POST /api/projects/[id]/modules` | ✅ | ✅ | ✅ | ✅ |
| **Membros da org** | | | | |
| `GET /api/orgs/members` | — | ✅ (lista todos) | ✅ (lista todos) | ✅ (só lista) |
| `POST /api/orgs/members` (convidar) | — | ✅ | ✅ | ❌ 403 |
| `PATCH /api/orgs/members/[id]` (editar role) | — | ✅ | ✅ (não pode editar OWNER) | ❌ 403 |
| `DELETE /api/orgs/members/[id]` (remover) | — | ✅ | ✅ (não pode remover OWNER) | ❌ 403 |
| `POST /api/orgs/members/[id]/reset-password` | — | ✅ | ❌ 403 | ❌ 403 |
| **Membros de projeto** | | | | |
| `GET /api/orgs/projects/[id]/members` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/orgs/projects/[id]/members` (adicionar) | ✅ | ✅ | ✅ | ❌ 403 |
| `DELETE /api/orgs/projects/[id]/members` (remover) | ✅ | ✅ | ✅ | ❌ 403 |
| **Configurações da org** | | | | |
| `PATCH /api/orgs/features` (ativar features) | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `PATCH /api/orgs/role-names` (renomear cargos) | ✅ | ✅ | ❌ 403 | ❌ 403 |
| **Casos de teste** | | | | |
| `GET /api/cases` | todos | todos da org | todos da org | só projetos vinculados |
| `POST /api/cases` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| `GET/PATCH/DELETE /api/cases/[id]` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| **Itens (User Stories)** | | | | |
| `GET /api/items` | todos | todos da org | todos da org | só projetos vinculados |
| `POST /api/items` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| `GET/PATCH/DELETE /api/items/[id]` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| **Execuções** | | | | |
| `GET /api/executions` | todos | todos da org | todos da org | só projetos vinculados |
| `POST /api/executions` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| `GET/PATCH /api/executions/[id]` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| **Planos de teste** | | | | |
| `GET /api/test-plans` | todos | todos da org | todos da org | só projetos vinculados |
| `POST /api/test-plans` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| `GET/PATCH/DELETE /api/test-plans/[id]` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| **Bugs** | | | | |
| `GET /api/bugs` | todos | todos da org | todos da org | só seus próprios bugs |
| `POST /api/bugs` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| **Reports** | | | | |
| `GET /api/reports` | todos | todos da org | todos da org | só projetos vinculados |
| `POST /api/reports` | ✅ | ✅ | ✅ | ✅ (proj. vinculado) |
| **Dashboard** | | | | |
| `GET /api/dashboard` | ✅ | ✅ | ✅ | ✅ (só proj. vinculados) |
| `GET /api/dashboard/qa` | ✅ | ✅ | ✅ | ❌ 403 |
| **Admin (plataforma)** | | | | |
| `GET/POST /api/admin/orgs` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |
| `GET/PATCH/DELETE /api/admin/orgs/[id]` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |
| `GET/POST /api/admin/orgs/[id]/members` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |
| `PATCH/DELETE /api/admin/orgs/[id]/members/[id]` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |
| `GET/POST /api/admin/superadmins` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |
| `DELETE /api/admin/superadmins/[id]` | ✅ (não pode remover a si mesmo) | ❌ 403 | ❌ 403 | ❌ 403 |
| `GET/POST /api/settings/ai` | ✅ | ❌ 403 | ❌ 403 | ❌ 403 |

#### Regras especiais

- **MEMBER vê bugs**: apenas os que ele mesmo criou (`authorId === u.id`)
- **OWNER não pode ser removido** por ninguém via `/api/orgs/members/[id]` — apenas Super Admin via `/api/admin/`
- **Reset de senha** é exclusivo do OWNER — nem ADMIN pode redefinir senha de outros membros
- **Features e role-names** só o OWNER altera — configurações que afetam toda a org
- **Super Admin nunca aparece** como membro de uma org — opera acima da estrutura de orgs

### Params assíncronos (Next.js 15+)

```ts
// CERTO — params é uma Promise
type Params = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
}
```

### Páginas client-side com params

```ts
// use() do React 19 — não useState + useEffect para params
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
}
```

---

## Banco de dados

- Migrations em `prisma/migrations/` — **não use `db push` em produção**, sempre `migrate dev` / `migrate deploy`.
- Todas as tabelas têm `organizationId` — sempre inclua no WHERE.
- Soft delete em `TestCase`: campo `isActive`, nunca `DELETE`.
- Versão de caso (`version`) é incrementada automaticamente no PATCH — não mexa manualmente.
- RLS habilitado no Supabase em todas as tabelas — Prisma usa service role (não afetado).

---

## Convenções de API

| Status | Quando usar |
|--------|-------------|
| 401 | Sem sessão |
| 403 | Sem permissão de papel (OWNER/ADMIN required) |
| 404 | Recurso não encontrado **ou** de outra org (IDOR) |
| 409 | Conflito (ex: projeto com itens não pode ser deletado) |
| 201 | Criação bem-sucedida |

---

## Frontend

- Componentes em `src/components/ui/` são primitivos — não altere sem necessidade.
- `useTerms()` para labels de entidades (projeto, bug, caso…) — nunca hardcode "Projeto" no JSX.
- `useLang()` para i18n e locale de datas.
- Notificações: polling via `useQuery` a cada 60s em `topbar.tsx` — não criar WebSocket.
- Dados de tabs carregados lazily com `enabled: activeTab === "tab"`.

---

## Testes E2E

- Specs em `tests/e2e/` com Playwright.
- Auth salvo em `tests/.auth/*.json` — gerado pelo `global.setup.ts`, ignorado pelo git.
- Use `page.request` (compartilha cookie da sessão), não o fixture `request` (sem cookie).
- Cross-org em `beforeAll`: `browser.newContext({ storageState: "tests/.auth/admin.json" })`.
- CI pausado por padrão (`workflow_dispatch` apenas) — reativar quando migrations estiverem estáveis.

---

## O que NÃO fazer

- Não use `findUnique` em rotas com `[id]` dinâmico sem validar org.
- Não retorne 403 onde 404 é o correto (ver padrão IDOR acima).
- Não crie migrations com `npx prisma db push` — gera diff sem histórico.
- Não use `DATETIME` em SQL — o banco é PostgreSQL, use `TIMESTAMP`.
- Não use `PRAGMA` — exclusivo do SQLite.
- Não hardcode texto de UI — use `useTerms()` e `useLang()`.
- Não adicione comentários que explicam O QUE o código faz — só comente o PORQUÊ quando não for óbvio.
