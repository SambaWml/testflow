# TestFlow — Documentação Técnica Completa

> Gerado em 2026-04-23. Atualizar após mudanças significativas de arquitetura.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Multi-tenancy e Permissões](#3-multi-tenancy-e-permissões)
4. [Banco de Dados](#4-banco-de-dados)
5. [Autenticação e Sessão](#5-autenticação-e-sessão)
6. [Rotas de API](#6-rotas-de-api)
7. [Páginas do Dashboard](#7-páginas-do-dashboard)
8. [Sistema de IA](#8-sistema-de-ia)
9. [Notificações](#9-notificações)
10. [Testes E2E](#10-testes-e2e)
11. [CI/CD](#11-cicd)
12. [Variáveis de Ambiente](#12-variáveis-de-ambiente)
13. [Terminologia Personalizável](#13-terminologia-personalizável)
14. [Gerador de Padrões de IA](#14-gerador-de-padrões-de-ia)
15. [Segurança](#15-segurança)
16. [Contas Seed](#16-contas-seed)

---

## 1. Visão Geral

O TestFlow é uma plataforma web **multi-tenant** para planejamento, execução e reporte de testes de software. Cada organização tem dados completamente isolados; usuários pertencem a uma organização e têm papéis que determinam o que podem ver e fazer.

**Funcionalidades principais:**
- Gerenciamento de projetos, itens (requisitos/histórias), casos de teste e execuções
- Planos de teste com rastreamento de status e taxa de aprovação
- Geração de casos de teste e bugs via IA (OpenAI, Manus AI, Ollama)
- Relatórios consolidados exportáveis em PDF e Markdown
- Painel de super-administração para gerenciar organizações
- Notificações em tempo real (polling) baseadas em dados existentes
- Documentação da API via Swagger UI em `/api-docs`

---

## 2. Arquitetura

```
testflow/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Páginas do usuário final (layout com sidebar)
│   │   │   ├── page.tsx          # Dashboard principal
│   │   │   ├── projects/         # Projetos e detalhe (/projects/[id])
│   │   │   ├── cases/            # Casos de teste
│   │   │   ├── executions/       # Execuções de teste
│   │   │   ├── bugs/             # Bugs
│   │   │   ├── reports/          # Relatórios
│   │   │   ├── generator/        # Gerador IA (casos e bugs)
│   │   │   └── settings/         # Configurações (geral, membros, projetos, gerador, termos)
│   │   ├── admin/                # Painel super-admin
│   │   ├── api/                  # API handlers (Next.js route handlers)
│   │   └── login/                # Página de login
│   ├── components/
│   │   ├── layout/               # Sidebar, Topbar (notificações, perfil, tema)
│   │   ├── ui/                   # Primitivos (Button, Input, Card, Dialog…)
│   │   └── cases/                # Dialogs específicos de casos de teste
│   ├── contexts/                 # React contexts (lang, theme, terms, session)
│   ├── lib/
│   │   ├── auth.ts               # Config NextAuth (JWT, credentials provider)
│   │   ├── prisma.ts             # Instância global do Prisma Client
│   │   ├── permissions.ts        # Lógica de papéis e filtragem por org/projeto
│   │   ├── email.ts              # Nodemailer — envio de e-mail via SMTP
│   │   └── enum-config.ts        # Enums de tipo/prioridade/status com labels
│   └── generated/prisma/         # Prisma Client gerado (não editar manualmente)
├── prisma/
│   ├── schema.prisma             # Schema do banco de dados
│   ├── seed.ts                   # Seed inicial (super admin + org demo)
│   └── migrations/               # Histórico de migrations SQL
├── tests/
│   └── e2e/                      # Playwright — testes end-to-end
│       ├── global.setup.ts       # Setup global: seed + auth states
│       ├── auth.spec.ts          # Redirecionamentos e 401 sem autenticação
│       ├── navigation.spec.ts    # Todas as páginas carregam corretamente
│       ├── projects.spec.ts      # CRUD de projetos
│       ├── cases.spec.ts         # CRUD de casos de teste
│       ├── items.spec.ts         # CRUD de itens
│       ├── executions.spec.ts    # Status de execuções
│       ├── bugs.spec.ts          # CRUD de bugs
│       ├── plans.spec.ts         # Planos de teste
│       ├── members.spec.ts       # Membros da org
│       ├── admin.spec.ts         # Painel super-admin
│       └── isolation.spec.ts     # Testes de isolamento IDOR entre orgs
├── playwright.config.ts          # Config Playwright (3 projetos de teste)
├── .github/workflows/ci.yml      # Pipeline CI (GitHub Actions)
└── DEPLOY.md                     # Guia completo de deploy
```

**Stack:**

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Linguagem | TypeScript 5 |
| UI | Radix UI + Tailwind CSS 4 |
| Formulários | React Hook Form + Zod |
| Estado servidor | TanStack Query v5 |
| Estado global | Zustand |
| Auth | NextAuth v5 (JWT, credentials) |
| ORM | Prisma 7 |
| Banco | PostgreSQL (Supabase) |
| IA | OpenAI SDK / Manus AI / Ollama |
| Gráficos | Recharts |
| PDF | @react-pdf/renderer |
| Email | Nodemailer (SMTP) |
| Testes | Playwright 1.59 |
| CI | GitHub Actions |

---

## 3. Multi-tenancy e Permissões

### Modelo de dados de tenant

Cada recurso (projeto, caso, execução, relatório…) tem um campo `organizationId`. Todos os endpoints filtram por esse campo para garantir isolamento.

```
User → OrgMember → Organization
                    └── Project → Item → TestCase → Execution
                    └── OrgMember (múltiplos usuários)
                    └── ProjectMember (acesso por projeto)
```

### Papéis

| Papel | Escopo | Permissões |
|-------|--------|-----------|
| **Super Admin** | Global | Acesso ao `/admin`; cria/lista/deleta orgs; vê dados de qualquer org |
| **Owner** | Organização | Tudo do Admin + configurações de dashboards, termos e org |
| **Admin** | Organização | Vê todos os projetos da org; convida membros; cria projetos |
| **Member** | Projetos vinculados | Vê apenas projetos onde foi adicionado via `ProjectMember`; cria itens e execuções |

### `src/lib/permissions.ts`

```typescript
// Retorna null se o usuário vê todos os projetos (OWNER/ADMIN), ou array de IDs
getProjectsForUser(userId, orgId, orgRole) → string[] | null

// SessionUser extraído da sessão NextAuth
sessionUser(session.user) → { id, name, email, role, isSuperAdmin, orgId, orgRole }
```

### Padrão IDOR

Para evitar vazamento de informação, recursos de outra org retornam **404** (não 403):

```typescript
// Correto — usa findFirst com organizationId na cláusula WHERE
const where = isSuperAdmin ? { id } : { id, organizationId: orgId! };
const resource = await prisma.resource.findFirst({ where });
if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

### Papéis de org personalizáveis

O campo `Organization.roleNames` é um JSON que mapeia os códigos internos para labels exibidos:

```json
{ "OWNER": "QA Lead", "ADMIN": "Analista", "MEMBER": "Testador" }
```

A sidebar lê isso via `GET /api/orgs/role-names` com cache de 5 minutos.

---

## 4. Banco de Dados

### Modelos principais

**Autenticação:**
- `User` — id, name, email, passwordHash, role, isSuperAdmin, avatarUrl
- `Account` — OAuth provider (para futuras integrações)
- `Session` — NextAuth session tokens

**Multi-tenancy:**
- `Organization` — code (sequential 1001+), slug, name, plan, isActive, roleNames (JSON), feature flags
- `OrgMember` — User ↔ Organization com role (OWNER/ADMIN/MEMBER), status, skills (JSON)
- `ProjectMember` — User ↔ Project com role (VIEWER/EDITOR/ADMIN)

**Entidades de teste:**
- `Project` — name, description, slug, isActive, organizationId
- `Module` — Container dentro do projeto (ex.: "Login", "Pagamentos")
- `Item` — Requisito/História/Bug; type (USER_STORY/BUG/IMPROVEMENT/REQUIREMENT/FLOW/TASK)
- `TestCase` — Caso de teste; format (BDD/STEPS), version (auto-incrementado no PATCH)
- `TestStep` — Passos de um caso no formato STEPS
- `Execution` — Resultado de uma execução; status (NOT_EXECUTED/PASS/FAIL/BLOCKED/RETEST/SKIPPED)
- `TestPlan` — Agrupa execuções; status (PENDING/IN_PROGRESS/COMPLETED/ABORTED)
- `TestPlanCase` — M:N entre TestPlan e TestCase com order
- `Evidence` — Arquivos/links anexados a uma Execution
- `Report` — Snapshot consolidado de execuções; metadata (JSON com counts e passRate)
- `ReportItem` — M:N entre Report e Execution com order
- `Setting` — Key-value global (configuração de IA ativa)
- `GenerationLog` — Log de uso do gerador IA

### Migrations

```bash
# Desenvolvimento (cria arquivo de migration)
npx prisma migrate dev --name descricao_da_mudanca

# Produção (aplica migrations pendentes)
npx prisma migrate deploy

# Gera o client após alterar o schema
npx prisma generate
```

### Row-Level Security (Supabase)

A migration `20260422000000_enable_rls` habilita RLS em todas as 19 tabelas. Isso bloqueia o acesso direto via REST API pública do Supabase (anon/authenticated roles). O Prisma usa a service role que **bypassa RLS** automaticamente — a aplicação não é afetada.

---

## 5. Autenticação e Sessão

**Provider:** Credentials (email + bcrypt hash)

**Estratégia:** JWT (sem banco de sessão — stateless)

### Fluxo

1. Usuário envia email + senha para `/api/auth/callback/credentials`
2. NextAuth busca o usuário no banco via Prisma
3. `bcrypt.compare(password, user.passwordHash)` — retorna erro se não bater
4. O callback `jwt()` popula o token com: `id, name, email, role, isSuperAdmin, orgId, orgRole`
5. O callback `session()` copia o token para o objeto de sessão acessível no cliente
6. O middleware NextAuth protege todas as rotas de dashboard — redireciona para `/login` se não autenticado

### Acesso no servidor

```typescript
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

const session = await auth();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const u = sessionUser(session.user);
// u.id, u.orgId, u.orgRole, u.isSuperAdmin
```

### Acesso no cliente

```typescript
import { useSession } from "next-auth/react";
const { data: session } = useSession();
const user = session?.user; // { name, email, isSuperAdmin, orgRole, ... }
```

---

## 6. Rotas de API

Todas as rotas ficam em `src/app/api/`. Exigem sessão autenticada (retornam 401 caso contrário).

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| ANY | `/api/auth/[...nextauth]` | Handler NextAuth (login, logout, session) |

### Super Admin
| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/admin/orgs` | Lista todas as orgs | isSuperAdmin |
| POST | `/api/admin/orgs` | Cria org + owner + envia credenciais por email | isSuperAdmin |
| GET | `/api/admin/orgs/[id]` | Detalhes da org com membros e projetos | isSuperAdmin |
| PATCH | `/api/admin/orgs/[id]` | Atualiza org | isSuperAdmin |
| DELETE | `/api/admin/orgs/[id]` | Deleta org | isSuperAdmin |
| POST | `/api/admin/orgs/[id]/members` | Adiciona membro à org | isSuperAdmin |
| PATCH | `/api/admin/orgs/[id]/members/[memberId]` | Altera papel do membro | isSuperAdmin |
| DELETE | `/api/admin/orgs/[id]/members/[memberId]` | Remove membro | isSuperAdmin |
| POST | `/api/admin/orgs/[id]/members/[memberId]/reset-password` | Reseta senha | isSuperAdmin |
| GET | `/api/admin/superadmins` | Lista super admins | isSuperAdmin |
| POST | `/api/admin/superadmins` | Cria super admin | isSuperAdmin |
| DELETE | `/api/admin/superadmins/[id]` | Revoga super admin ou deleta usuário | isSuperAdmin |

### Organizações e Membros
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/orgs/me` | Dados da org atual do usuário |
| GET | `/api/orgs/members` | Lista membros da org |
| POST | `/api/orgs/members` | Convida membro (cria usuário se novo, envia email) |
| PATCH | `/api/orgs/members/[id]` | Altera papel do membro |
| DELETE | `/api/orgs/members/[id]` | Remove membro da org |
| POST | `/api/orgs/members/[id]/reset-password` | Envia e-mail de reset de senha |
| GET | `/api/orgs/role-names` | Labels personalizados dos papéis |
| PATCH | `/api/orgs/role-names` | Atualiza labels dos papéis |
| GET | `/api/orgs/features` | Feature flags da org |
| PATCH | `/api/orgs/features` | Atualiza feature flags |
| GET | `/api/orgs/projects/[id]/members` | Membros de um projeto |
| POST | `/api/orgs/projects/[id]/members` | Adiciona usuário a um projeto |
| DELETE | `/api/orgs/projects/[id]/members` | Remove usuário de um projeto |

### Projetos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/projects` | Lista projetos (filtrado por papel; `?all`, `?activeOnly`) |
| POST | `/api/projects` | Cria projeto (OWNER/ADMIN) |
| GET | `/api/projects/[id]` | Detalhes + `_count` (items, cases, testPlans, executions, reports) |
| PATCH | `/api/projects/[id]` | Atualiza; `isActive` propaga para TestCases em transação |
| DELETE | `/api/projects/[id]` | Deleta; retorna 409 se tiver itens vinculados |
| GET | `/api/projects/[id]/modules` | Módulos do projeto |
| POST | `/api/projects/[id]/modules` | Cria módulo |

### Casos de Teste
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cases` | Lista casos (`?q`, `?format`, `?projectId`, `?limit`) |
| POST | `/api/cases` | Cria caso (BDD ou Steps) |
| GET | `/api/cases/[id]` | Caso com passos |
| PATCH | `/api/cases/[id]` | Atualiza; incrementa `version` automaticamente |
| DELETE | `/api/cases/[id]` | Soft delete (`isActive = false`) |
| POST | `/api/cases/bulk` | Criação em lote |
| DELETE | `/api/cases/bulk` | Soft delete em lote |
| POST | `/api/cases/generate` | Gera casos via IA |

### Itens
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/items` | Lista itens |
| POST | `/api/items` | Cria item |
| GET | `/api/items/[id]` | Detalhes do item |
| PATCH | `/api/items/[id]` | Atualiza item |
| DELETE | `/api/items/[id]` | Deleta item |

### Bugs
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/bugs` | Lista bugs; MEMBER vê só os próprios |
| POST | `/api/bugs` | Cria bug |
| POST | `/api/bugs/bulk` | Criação em lote |
| POST | `/api/bugs/generate` | Gera bugs via IA |

### Execuções
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/executions` | Lista execuções filtradas por org e projetos |
| POST | `/api/executions` | Cria execução |
| PATCH | `/api/executions/[id]` | Atualiza status, notas, bugs relacionados |
| DELETE | `/api/executions/[id]` | Remove execução |

### Planos de Teste
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/test-plans` | Lista planos (`?status`, `?projectId`) |
| POST | `/api/test-plans` | Cria plano com casos associados |
| GET | `/api/test-plans/[id]` | Plano com items e execuções |
| PATCH | `/api/test-plans/[id]` | Atualiza; auto-stampa `startedAt`/`completedAt` |
| DELETE | `/api/test-plans/[id]` | Deleta plano |

### Relatórios
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/reports` | Lista relatórios |
| POST | `/api/reports` | Cria relatório a partir de um plano (IDOR guard via org check) |
| GET | `/api/reports/[id]` | Detalhes do relatório com metadata snapshot |
| GET | `/api/reports/[id]/pdf` | Gera e baixa PDF |

### Evidências e Arquivos
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/evidence` | Upload de arquivo de evidência |
| POST | `/api/upload` | Upload de arquivo genérico |
| GET | `/api/uploads/[filename]` | Download de arquivo |

### Dashboard e Status
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard` | KPIs e dados de gráfico |
| GET | `/api/dashboard/qa` | Métricas do dashboard QA |
| GET | `/api/ai-status` | Status do provedor de IA ativo |
| GET | `/api/notifications` | Notificações derivadas de execuções e membros |
| GET | `/api/user/profile` | Perfil do usuário logado |
| PATCH | `/api/user/profile` | Atualiza nome, email, senha |
| GET | `/api/settings/ai` | Configuração de IA salva |
| PATCH | `/api/settings/ai` | Atualiza provedor e chaves de IA |
| GET | `/api/docs` | Spec OpenAPI JSON |

---

## 7. Páginas do Dashboard

Todas exigem autenticação. Layout em `src/app/(dashboard)/layout.tsx` com `Sidebar` e `Topbar`.

| Rota | Arquivo | Acesso | Descrição |
|------|---------|--------|-----------|
| `/` | `page.tsx` | Todos | Dashboard com KPIs, gráfico de status, ações rápidas |
| `/projects` | `projects/page.tsx` | Todos | Lista projetos; nome é link para o detalhe |
| `/projects/[id]` | `projects/[id]/page.tsx` | Todos | Detalhe com stat cards e 4 tabs (items, cases, planos, bugs) |
| `/cases` | `cases/page.tsx` | Todos | Casos de teste com filtros e bulk delete |
| `/executions` | `executions/page.tsx` | Todos | Execuções com rastreamento de status |
| `/bugs` | `bugs/page.tsx` | Todos | Bugs com filtros e gerador IA |
| `/reports` | `reports/page.tsx` | Todos | Relatórios com download PDF |
| `/generator` | `generator/page.tsx` | Todos | Gerador de casos via IA |
| `/generator/bugs` | `generator/bugs/page.tsx` | Todos | Gerador de bugs via IA |
| `/settings/general` | `settings/general/page.tsx` | OWNER/ADMIN | Nome da org, idioma, Sobre |
| `/settings/members` | `settings/members/page.tsx` | OWNER/ADMIN | Convidar e gerenciar membros |
| `/settings/projects` | `settings/projects/page.tsx` | OWNER/ADMIN | Gerenciar projetos da org |
| `/settings/generator` | `settings/generator/page.tsx` | Todos | Formatos bloqueados + padrões do gerador |
| `/settings/terms` | `settings/terms/page.tsx` | OWNER | Terminologia personalizável |
| `/settings/dashboards` | `settings/dashboards/page.tsx` | OWNER | Ativar/renomear dashboards |
| `/admin` | `admin/page.tsx` | isSuperAdmin | Painel de organizações |
| `/api-docs` | (Swagger UI estático) | OWNER/ADMIN/SuperAdmin | Documentação interativa da API |

---

## 8. Sistema de IA

### Provedores suportados

| Provedor | Modelo padrão | Variável |
|----------|--------------|----------|
| OpenAI | `gpt-4o` | `OPENAI_API_KEY` |
| Manus AI | `claude-sonnet-4-5` | `MANUS_API_KEY` + `MANUS_BASE_URL` |
| Ollama (local) | configurável | `OLLAMA_URL` + `OLLAMA_MODEL` |

A configuração ativa é salva em `Setting` (banco) via `/admin/ai`. Fallback para variáveis de ambiente se não houver setting salvo.

### Endpoints de geração

- `POST /api/cases/generate` — Recebe `{ itemId, quantity, format, language, coverage, testType, priority }`, retorna array de casos gerados
- `POST /api/bugs/generate` — Recebe `{ title, description, projectId, quantity }`, retorna array de bugs

### Log de uso

Cada geração registra um `GenerationLog` com: `itemId, prompt, modelUsed, tokensUsed, casesCount, format, language, coverageLevel, testType`.

---

## 9. Notificações

Sem tabela de notificações no banco — derivadas em tempo real de dados existentes.

**Endpoint:** `GET /api/notifications`

**Fontes:**
| Tipo | Fonte | Condição |
|------|-------|----------|
| `error` | `Execution.status = FAIL` | últimos 7 dias |
| `warning` | `Execution.status = NOT_EXECUTED` | todas as ativas |
| `info` | `OrgMember.invitedAt` | últimos 7 dias, `count > 1` |

O threshold `> 1` para novos membros existe porque a própria entrada do owner é contabilizada na janela.

**Poll:** A Topbar consulta o endpoint a cada **60 segundos** via TanStack Query (`refetchInterval: 60_000, staleTime: 30_000`).

**Badge:** Número exibido no ícone de sino. Abre um dropdown com lista de notificações clicáveis.

---

## 10. Testes E2E

### Configuração (playwright.config.ts)

4 projetos Playwright compartilhando um setup global:

```
setup             → global.setup.ts (seed + salva cookies)
admin-tests       → todos os specs exceto isolation e admin
superadmin-tests  → admin.spec apenas
isolation-tests   → isolation.spec apenas
```

### Arquivos de auth

Salvos em `tests/.auth/` (ignorado pelo git):
- `admin.json` — `admin@testflow.com`
- `superadmin.json` — `superadmin@testflow.com`
- `isolated.json` — `e2e-isolated@test.com` (org separada)

### Specs

| Arquivo | Testes | Foco |
|---------|--------|------|
| `auth.spec.ts` | 27 | Redirecionamentos sem auth; 401 em todos os endpoints |
| `navigation.spec.ts` | 23 | Todas as páginas carregam; APIs retornam estrutura correta |
| `projects.spec.ts` | 9 | CRUD completo de projetos |
| `cases.spec.ts` | 14 | CRUD, campos BDD, passos, versão, soft-delete |
| `items.spec.ts` | 12 | CRUD, defaults de tipo/prioridade, módulo |
| `executions.spec.ts` | 8 | PASS/FAIL/BLOCKED, relatedBugRef, DELETE |
| `bugs.spec.ts` | 11 | type=BUG, status=OPEN, CRUD |
| `plans.spec.ts` | 10 | Criação com casos, validações |
| `members.spec.ts` | 9 | Convite, duplicata bloqueada, tempPassword |
| `admin.spec.ts` | 10 | Super admin: /admin, /api/admin/orgs, revogação |
| `isolation.spec.ts` | 21 | IDOR: cross-org bloqueado (cases, items, plans, projects, reports) |

### Scripts

```bash
npm run test:e2e          # Headless (CI)
npm run test:e2e:ui       # Playwright UI (modo visual)
npm run test:e2e:debug    # Debug interativo
npm run test:e2e:report   # Abre o HTML report
```

---

## 11. CI/CD

**Arquivo:** `.github/workflows/ci.yml`

**Triggers:** push e pull_request para `master`/`main`

**Steps:**
1. Checkout + Node 20 + `npm ci`
2. `npx prisma generate`
3. `npx prisma migrate deploy` (PostgreSQL 16 ephemeral no Actions)
4. `npm run seed` — cria contas de teste
5. `npx tsc --noEmit` — type check (falha o job se houver erros)
6. `npm run lint` — lint (continue-on-error; warnings pré-existentes não bloqueiam)
7. `npx playwright install --with-deps chromium`
8. `npm run test:e2e` — 1 worker sequencial
9. Upload do HTML report como artefato (7 dias de retenção)

**Tempo limite:** 30 min. **Retries:** 2 no CI.

---

## 12. Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Connection string PostgreSQL (pooler porta 6543 no Supabase) |
| `DIRECT_URL` | Supabase | Connection direta para migrations (porta 5432) |
| `NEXTAUTH_SECRET` | Sim | Secret JWT (use `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Sim | URL pública da aplicação |
| `SMTP_HOST` | Email | Host SMTP |
| `SMTP_PORT` | Email | Porta SMTP |
| `SMTP_SECURE` | Email | `true` para SSL direto, `false` para STARTTLS |
| `SMTP_USER` | Email | Usuário SMTP |
| `SMTP_PASS` | Email | Senha/app-password SMTP |
| `SMTP_FROM` | Email | Remetente (ex: `TestFlow <noreply@...>`) |
| `OPENAI_API_KEY` | IA (OpenAI) | Chave da API OpenAI |
| `OPENAI_MODEL` | IA | Modelo OpenAI (padrão: `gpt-4o`) |
| `MANUS_API_KEY` | IA (Manus) | Chave da API Manus |
| `MANUS_BASE_URL` | IA (Manus) | URL base da Manus |
| `OLLAMA_URL` | IA (Ollama) | URL local do Ollama |
| `OLLAMA_MODEL` | IA (Ollama) | Modelo Ollama |
| `NODE_ENV` | CI | `test` no CI, `production` em prod |

---

## 13. Terminologia Personalizável

O sistema expõe 12 termos editáveis em **Configurações → Termos**. Armazenados em `localStorage` por idioma, aplicados dinamicamente via `useTerms()` context.

| Chave | Padrão pt-BR |
|-------|-------------|
| `projeto` | Projeto / Projetos |
| `bug` | Bug / Bugs |
| `relatorio` | Relatório / Relatórios |
| `execucao` | Execução / Execuções |
| `casoDeTeste` | Caso de Teste / Casos de Teste |
| `planoDeTeste` | Plano de Teste / Planos de Teste |
| `item` | Item / Itens |
| `ambiente` | Ambiente / Ambientes |
| `build` | Build / Versão |
| `evidencia` | Evidência / Evidências |
| `bugRelacionado` | Bug Relacionado |
| `preCondicao` | Pré-condição |

---

## 14. Gerador de Padrões de IA

**Página:** `/settings/generator`

**DefaultsCard** — salva em `localStorage` (chave `testflow_generator_defaults`):

| Campo | Opções | Padrão |
|-------|--------|--------|
| Idioma | pt-BR, en-US, es | pt-BR |
| Quantidade | 3, 5, 8, 10, 15, 20 | 5 |
| Cobertura | smoke, normal, edge | normal |
| Tipo de teste | functional, regression, exploratory, performance, security | functional |
| Prioridade | CRITICAL, HIGH, MEDIUM, LOW | MEDIUM |

**FormatsCard** — formatos de caso bloqueados (chave `testflow_blocked_formats`): impede que o gerador produza casos em formatos desabilitados pela org.

---

## 15. Segurança

### Autenticação
- Senhas hashed com `bcrypt` (cost factor 12)
- JWT stateless — sem tabela de sessão
- Middleware NextAuth protege todas as rotas de dashboard

### Autorização
- Toda rota de API verifica `auth()` antes de qualquer lógica
- Recursos de outra org retornam 404 (não 403) para não confirmar existência
- Super admins têm bypass explícito por flag `isSuperAdmin`, não por papel de org

### IDOR Prevention
- `findFirst` com `{ id, organizationId }` em vez de `findUnique` em endpoints críticos
- `POST /api/reports` valida `testPlan.organizationId === u.orgId` antes de criar

### RLS (Supabase)
- RLS habilitado em todas as 19 tabelas via migration
- Bloqueia o acesso via REST API pública do Supabase (anon/authenticated roles)
- Prisma usa service role — não afetado

### Isolamento testado
- `tests/e2e/isolation.spec.ts` — 21 casos IDOR testados automaticamente em CI
- `tests/e2e/auth.spec.ts` — 27 casos de auth sem sessão testados

---

## 16. Contas Seed

Criadas por `npm run seed`:

| Email | Senha | Papel |
|-------|-------|-------|
| `superadmin@testflow.com` | `admin123` | Super Admin |
| `admin@testflow.com` | `admin123` | Owner (Demo Org) |

Criadas pelo setup E2E (`tests/e2e/global.setup.ts`):

| Email | Senha | Papel |
|-------|-------|-------|
| `e2e-isolated@test.com` | `E2eTest123!` | Owner (E2E Isolated Org) |

> **Atenção:** Alterar as senhas das contas seed após o primeiro deploy em produção.
