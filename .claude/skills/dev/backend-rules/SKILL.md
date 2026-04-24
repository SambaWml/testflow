---
name: backend-rules
description: Regras e boas práticas para código backend do TestFlow (Next.js 16 API routes + NextAuth v5 + Prisma 7 + multi-tenant). Use ao criar/editar rotas em `src/app/api/`, libs de `src/lib/`, middleware `src/proxy.ts`, ou qualquer código server-side.
---

# Backend Rules — TestFlow

Stack: **Next.js 16 API Routes (App Router) + NextAuth v5 (JWT) + Prisma 7 + PostgreSQL (Supabase) + Zod**.

## Autenticação — em TODA rota

```ts
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  // ...
}
```

Nunca confie em header, cookie cru, body, ou query para identificar usuário/org. Sempre via `session`.

## Multi-tenant — isolamento obrigatório

**Toda tabela tem `organizationId`.** Toda consulta deve filtrar por org, exceto quando `u.isSuperAdmin === true`.

### Regra de ouro: nunca `findUnique` em recurso com org

```ts
// ERRADO — IDOR: retorna recurso de outra org
prisma.project.findUnique({ where: { id } });

// CERTO
const where = u.isSuperAdmin ? { id } : { id, organizationId: u.orgId! };
const project = await prisma.project.findFirst({ where });
if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

Recurso de outra org → **404**, nunca 403. Não confirma existência cross-tenant.

### Escopo por projeto (além de org)

```ts
import { getProjectsForUser } from "@/lib/permissions";

const projectIds = await getProjectsForUser(u.id, u.orgId!, u.orgRole);
// null = OWNER/ADMIN, sem filtro extra
// string[] = MEMBER/VIEWER, filtra apenas os projetos vinculados
const where = {
  organizationId: u.orgId!,
  ...(projectIds ? { projectId: { in: projectIds } } : {}),
};
```

`null` significa "pule o filtro de projectId", **não** "sem acesso". Esse é o erro mais comum aqui.

## Params assíncronos (Next 15+)

```ts
type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  // ...
}
```

## Status codes — tabela

| Status | Uso |
|---|---|
| 200 | GET/PATCH/PUT OK |
| 201 | POST criou com sucesso |
| 204 | DELETE sem body de resposta |
| 400 | Body inválido (Zod falhou) |
| 401 | Sem sessão |
| 403 | Autenticado mas sem papel/permissão |
| 404 | Não existe OU pertence a outra org |
| 409 | Conflito (ex: projeto com itens não pode ser deletado) |
| 422 | Regra de negócio violada |
| 500 | Erro inesperado — logar, não vazar stack |

## Validação com Zod

```ts
const createCaseSchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().uuid(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

const parsed = createCaseSchema.safeParse(await req.json());
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
}
const data = parsed.data;
```

- Valide **tudo** que vem de fora: body, query, params.
- Um schema por endpoint (ou reutilize de `src/types/`).
- Nunca passe `req.json()` direto para `prisma.create` — é exposição de campos (mass-assignment).

## Prisma — padrões

- **Cliente singleton** já configurado em `src/lib/prisma.ts`. Importe de lá.
- **Transações** para escritas relacionadas (ex: criar case + versionar): `prisma.$transaction([...])` ou `prisma.$transaction(async tx => {...})`.
- **Soft delete em `TestCase`**: `isActive = false`. Nunca `DELETE`. Listagens filtram `isActive: true`.
- **Versão de caso**: incrementada automaticamente no PATCH. Não mexa manualmente no campo `version`.
- **Select explícito** em recursos com dados sensíveis. Evite `include` largo em listagens — use `select` com só o necessário.
- **N+1**: use `include`/`select` aninhado em vez de loops com queries.

```ts
// Bom: 1 query
const cases = await prisma.testCase.findMany({
  where: { organizationId: u.orgId!, isActive: true },
  select: { id: true, title: true, project: { select: { name: true } } },
});
```

## Migrations

- **Sempre `prisma migrate dev`** (que aponta para `DIRECT_URL`, porta 5432). Nunca `prisma db push` em produção — gera drift sem histórico.
- `DATABASE_URL` (pooler 6543) rejeita DDL → migrations explodem se apontar pra lá.
- Em CI/prod: `npx prisma migrate deploy`.
- Nunca edite migration já aplicada em outro ambiente. Faça uma nova.

## Errors e logging

```ts
try {
  // ...
} catch (err) {
  console.error("[api/cases] POST failed:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

- Nunca vaze stack/mensagem crua pro cliente.
- Log com prefixo da rota para ser grep-ável.
- Erros esperados (validação, permissão) não são `try/catch` — retorne status diretamente.

## Princípios Node / TS

- **DRY**: extraia repetição genuína para `src/lib/` (ex: scoping de org, paginação). Repetição acidental não precisa de extração.
- **YAGNI**: não adicione campos, flags, ou rotas "para o futuro". Adicione quando o caller existir.
- **KISS**: rota fluxo linear — validar → autorizar → executar → responder. Evite camadas "service/repository/controller" dentro de uma rota simples.
- **Fail fast**: valide no início. Retorne cedo (guard clauses).
- **Pure onde puder**: funções de negócio em `src/lib/` sem tocar `prisma` são mais testáveis.
- **Sem `any`**. Se precisar escapar tipos, use `unknown` + narrowing.
- **Imutabilidade**: `const` por padrão, spreads em vez de mutação.
- **Async sempre com await** — nunca `.then()` misturado. Lide com promises sempre.

## Rate limiting e segurança

- Rotas de auth (login/signup/reset) devem ter rate limit — não reimplemente ad-hoc, use middleware.
- Nunca logue body de `/api/auth/*` nem tokens.
- Sanitize `UPLOAD` — valide mime, tamanho, extensão. Armazene fora de `public/` quando privado.
- Headers de segurança já estão no `src/proxy.ts` — não quebre ao editar.

## OpenAPI

Toda rota nova ou renomeada: atualize `src/lib/openapi.ts`. O spec é servido em `/api-docs` (Swagger UI). Spec desatualizado é bug.

## Checklist antes de abrir PR

- [ ] `auth()` no início da rota.
- [ ] Filtro de `organizationId` em toda query de recurso multi-tenant.
- [ ] `findFirst` em vez de `findUnique` para IDs vindos do path.
- [ ] 404 (não 403) para recurso cross-org.
- [ ] Zod validando body/query.
- [ ] Status code correto (ver tabela).
- [ ] OpenAPI atualizado se endpoint mudou.
- [ ] `npm run lint` limpo.
- [ ] Sem vazamento de stack em 500.
