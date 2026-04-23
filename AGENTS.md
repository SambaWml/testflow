<!-- BEGIN:nextjs-agent-rules -->
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
<!-- END:nextjs-agent-rules -->
