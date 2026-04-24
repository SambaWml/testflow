---
name: data-supabase-rules
description: Regras para modelar e consultar o banco (PostgreSQL + Supabase via Prisma 7) seguindo boas práticas relacionais. Use ao editar `prisma/schema.prisma`, criar migrations, escrever SQL cru, configurar RLS, ou otimizar queries.
---

# Data & Supabase Rules — TestFlow

Banco: **PostgreSQL via Supabase**, acessado pelo **Prisma 7** com `@prisma/adapter-pg`. Provider sempre `postgresql` — nunca `sqlite` ou `mysql` no `schema.prisma`.

## URLs do Supabase — qual usar

| Variável | Porta | Uso |
|---|---|---|
| `DATABASE_URL` | 6543 (Supavisor pooler) | **Runtime** — todas as queries da app. Rejeita DDL. |
| `DIRECT_URL` | 5432 (conexão direta) | **Migrations** — `prisma migrate dev/deploy`, `prisma studio`. |

Já está configurado: `prisma.config.ts` aponta migrations para `DIRECT_URL`; `src/lib/prisma.ts` usa `DATABASE_URL`. Nunca rode migration com `DATABASE_URL` — o pooler bloqueia e o erro é enganoso.

## Modelagem relacional — princípios

1. **Normalize até 3FN por padrão.** Desnormalize só com motivo medido (perf ou leitura agregada frequente) — e documente.
2. **Chave primária**: `id String @id @default(cuid())` (padrão do projeto) ou `uuid()`. Evite chaves compostas como PK — use índice único.
3. **FKs explícitas** com `onDelete` definido:
   - `Cascade` para filhos que não fazem sentido sem o pai (ex: `TestStep` → `TestCase`).
   - `Restrict` para proteger dados "de verdade" (ex: `Project` com `TestCase` ativo).
   - `SetNull` quando a referência é opcional e a entidade filha sobrevive.
4. **Nunca** cascade em FK para `Organization` sem pensar duas vezes — deletar org apaga tudo.
5. **Soft delete** só onde faz sentido (hoje: `TestCase.isActive`). Hard delete é o default.
6. **Timestamps**: `createdAt DateTime @default(now())` e `updatedAt DateTime @updatedAt` em entidades de domínio.
7. **Enums** no schema Prisma (não string livre) para status/papel/prioridade — força validação no tipo.

## Multi-tenant no schema

- **Toda tabela de domínio tem `organizationId String`** com FK para `Organization`.
- Crie **índice composto** `(organizationId, <colunaFiltrada>)` para filtros comuns. Nunca índice só em `organizationId` isolado — quase nunca é usado sozinho.

```prisma
model TestCase {
  id             String @id @default(cuid())
  organizationId String
  projectId      String
  isActive       Boolean @default(true)
  title          String
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([organizationId, projectId, isActive])
  @@index([organizationId, createdAt])
}
```

## Índices — regras práticas

- **Cada FK**: índice (Postgres **não** cria automaticamente como MySQL/InnoDB).
- **Coluna usada em `WHERE`/`ORDER BY`/`JOIN`**: candidata a índice.
- **Composto**: ordene pela coluna mais **seletiva primeiro** e alinhe com o padrão de query.
- **Partial index** (`@@index([...], where: ...)` via SQL raw) para coluna com predicado fixo (`isActive = true`).
- **Não indexe demais** — cada índice custa em escrita. Meça com `EXPLAIN ANALYZE` antes de adicionar "por garantia".
- **`@unique` composto** para constraint de negócio (ex: `@@unique([organizationId, slug])`).

## Tipos — o correto

| Tipo | Prisma | Postgres | Obs |
|---|---|---|---|
| Texto curto | `String` | `TEXT` | Sem limite — use Zod no app. |
| Data/hora | `DateTime` | `TIMESTAMPTZ` | Sempre com timezone. Nunca `DATETIME` (SQLite). |
| Decimal monetário | `Decimal` | `NUMERIC(p,s)` | Nunca `Float` para dinheiro. |
| ID | `String @id @default(cuid())` | `TEXT` | Ou `uuid()`. |
| JSON | `Json` | `JSONB` | Evite — se estrutura é estável, vira tabela. |
| Enum | `enum` Prisma | nativo | Preferível a `String` livre. |

**Não existe**: `PRAGMA`, `AUTOINCREMENT` (SQLite), `TINYINT`, `DATETIME` sem timezone. Se leu isso em código, é bug ou migration antiga.

## Migrations — workflow

```bash
# Dev — cria migration + aplica em DIRECT_URL
npm run db:push   # = prisma migrate dev

# Prod/CI — aplica pendentes sem gerar nova
npx prisma migrate deploy

# Após editar schema
npx prisma generate
```

Regras:

- **Migration já aplicada em outro ambiente é imutável.** Problema? Nova migration reverte/corrige.
- Nome descritivo: `add_testcase_priority_index`, não `update_schema_1`.
- Migration com `DROP COLUMN` ou `ALTER TYPE` em tabela grande: considere estratégia em 2 passos (adicionar nova coluna → backfill → remover antiga) para não travar tabela.
- `NOT NULL` em coluna nova de tabela existente: adicione como nullable, backfill, depois altere.

## Queries — padrões via Prisma

### Select explícito

```ts
// Evite include cego em listagens
const cases = await prisma.testCase.findMany({
  where: { organizationId, isActive: true },
  select: {
    id: true,
    title: true,
    project: { select: { id: true, name: true } },
    _count: { select: { steps: true } },
  },
  orderBy: { createdAt: "desc" },
  take: 50,
});
```

### Paginação

- **Offset** (`skip`/`take`) para listas curtas (< poucos milhares).
- **Cursor** (`cursor: { id }`) para listas grandes / infinite scroll — estável sob inserção.

### Transações

```ts
await prisma.$transaction(async (tx) => {
  const next = await tx.testCase.update({
    where: { id },
    data: { version: { increment: 1 } },
  });
  await tx.testCaseHistory.create({ data: { caseId: id, version: next.version, ... } });
});
```

Use transação para invariantes multi-tabela. Nunca faça `findFirst` + `update` separados quando a regra exige atomicidade — use `update` com `where` específico ou `updateMany` + checagem de count.

### Concorrência

- Versioning otimista: campo `version` + `updateMany({ where: { id, version: expected }, data: { version: { increment: 1 }, ... } })`. Se `count === 0`, alguém atualizou antes.
- Evite `SELECT ... FOR UPDATE` via `$queryRaw` salvo necessidade real — escalabilidade sofre.

### SQL raw

- `$queryRaw` / `$executeRaw` **sempre parametrizado** (template tagged): ```prisma.$queryRaw`SELECT ... WHERE id = ${id}` ```. Nunca interpole string — SQL injection.
- Restrito a casos que Prisma não cobre (CTE complexa, `INSERT ... ON CONFLICT`). Documente o porquê.

## Supabase RLS

- RLS está **habilitada em todas as tabelas**. Prisma usa a **service role key**, que bypassa RLS — ou seja, **o isolamento multi-tenant é garantido no código da aplicação** (filtro `organizationId`), não na RLS.
- **Mesmo assim, mantenha policies em dia** — são defesa em profundidade se algum dia um client direto (não-service-role) for introduzido.
- Ao criar tabela nova: adicione migration SQL com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` + policies mínimas.
- Auth de usuário no Supabase **não é usada** pelo TestFlow — auth é NextAuth. `auth.uid()` em policies não resolve aqui.

## Performance — ordem de ataque

1. **`EXPLAIN ANALYZE`** na query lenta (via `prisma studio` ou `psql` com `DIRECT_URL`).
2. Procure `Seq Scan` em tabela grande → índice faltando.
3. Procure `Nested Loop` com muitas linhas → `JOIN` sem índice no lado direito.
4. Muitas queries em loop → `include`/`select` aninhado ou `findMany` com `in`.
5. **Só então** considere cache (em `src/lib/`) ou materialized view.

## Não faça

- ❌ `findUnique` em recurso multi-tenant por ID vindo do path (IDOR — ver `backend-rules`).
- ❌ Migration via `prisma db push` em produção.
- ❌ `DELETE` em `TestCase` — use `isActive = false`.
- ❌ `Float` para dinheiro / quantidade exata.
- ❌ `JSON` como estrutura principal quando o shape é conhecido.
- ❌ Interpolar string em SQL raw.
- ❌ Índice "por via das dúvidas" sem medir.
- ❌ `PRAGMA`, `DATETIME`, `AUTOINCREMENT` — isso é SQLite.

## Checklist ao editar schema

- [ ] `organizationId` + FK `onDelete: Cascade` em tabela de domínio.
- [ ] Índice composto cobrindo o padrão de query real.
- [ ] Tipos corretos (`DateTime`, `Decimal`, enum).
- [ ] Migration nomeada com clareza.
- [ ] `prisma generate` rodado.
- [ ] Policy RLS adicionada para a tabela nova.
- [ ] OpenAPI / tipos da API atualizados se o shape vaza para o cliente.
