# TestFlow

Plataforma web multi-tenant para planejamento, execução e reporte de testes de software — com geração de casos de teste via IA, notificações em tempo real e painel de super-administração.

> **Documentação técnica completa:** [SYSTEM.md](SYSTEM.md)  
> **Guia de deploy:** [DEPLOY.md](DEPLOY.md)

---

## Funcionalidades

### Módulos principais

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | Visão geral com KPIs, gráfico de status, taxa de aprovação e ações rápidas. Dashboard QA com filtros por período, membro, projeto e prioridade. |
| **Projetos** | Lista e detalhe de projetos com stat cards e tabs de itens, casos, planos e bugs. |
| **Casos de Teste** | Visualização em lista ou grade, filtros por projeto/formato/prioridade, exclusão em lote. |
| **Gerador IA** | Geração de casos BDD ou Step-by-Step via IA. Suporte a OpenAI, Manus AI e Ollama. Pode criar Plano de Teste diretamente após a geração. |
| **Execuções** | Executa planos de teste caso a caso, registra status, notas, bugs relacionados e evidências. |
| **Relatórios** | Consolida execuções, exibe estatísticas de aprovação/reprovação, exporta para PDF ou copia como Markdown. |
| **Bugs** | Registro e acompanhamento de bugs com status, prioridade e projeto. |
| **Notificações** | Bell icon na topbar com polling de 60s — exibe falhas recentes, execuções pendentes e novos membros. |
| **API Docs** | Swagger UI interativo em `/api-docs`, acessível para admins e owners. |

### Configurações

| Submenu | Descrição |
|---------|-----------|
| **Geral** | Nome da organização, idioma (pt-BR / en-US) e aba "Sobre". |
| **Dashboards** | Ativa/desativa e renomeia os dashboards (somente Owner). |
| **Termos** | Personaliza os 12 termos do sistema (singular e plural). |
| **Membros** | Convida, visualiza e remove membros da organização. |
| **Projetos** | Gerencia os projetos da organização. |
| **Gerador IA** | Formatos bloqueados + padrões de geração (idioma, quantidade, cobertura, tipo, prioridade) salvos em localStorage. |

### Painel Super Admin (`/admin`)

| Seção | Descrição |
|-------|-----------|
| **Organizações** | Lista, cria, ativa/desativa e exclui organizações. |
| **Super Admins** | Gerencia contas com acesso ao painel de administração. |
| **Configuração IA** | Define o provedor de IA ativo (OpenAI / Manus AI / Ollama) e suas chaves de API. |

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript 5 |
| UI | React 19 + Radix UI + Tailwind CSS 4 |
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

## Setup local

### Requisitos

- Node.js 20+
- Banco PostgreSQL (ex.: Supabase) **ou** SQLite para desenvolvimento

### Instalação

```bash
npm install
```

### Variáveis de ambiente

Crie `.env.local` na raiz do projeto:

```env
# Banco de dados
# Pooler (usado pela aplicação em runtime — porta 6543 para Supabase)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@[region].pooler.supabase.com:6543/postgres"

# Conexão direta (usada pelo Prisma para migrations — porta 5432)
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Auth
NEXTAUTH_SECRET="seu-secret-aqui"
NEXTAUTH_URL="http://localhost:3000"

# SMTP (convites por e-mail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu@email.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM=TestFlow <seu@email.com>

# IA — opcional, configurável também pelo painel Super Admin
# OPENAI_API_KEY="sk-..."
# MANUS_API_KEY="sk-..."
# MANUS_BASE_URL="https://api.manus.ai"
# OLLAMA_URL="http://localhost:11434"
# OLLAMA_MODEL="deepseek-r1:7b"
```

### Banco de dados

```bash
# Aplica o schema e gera o client Prisma
npx prisma db push

# Popula o banco com dados iniciais (super admin + org demo)
npm run seed
```

### Iniciar

```bash
npm run dev
```

Acesse: http://localhost:3000

**Login super admin:** `superadmin@testflow.com` / `admin123`  
**Login demo (org):** `admin@testflow.com` / `admin123`

---

## Testes E2E

O projeto usa **Playwright** com 3 contextos de usuário (admin, super admin, org isolada).

```bash
# Requisito: servidor rodando em localhost:3000
npm run dev

# Em outro terminal:
npm run test:e2e          # headless
npm run test:e2e:ui       # interface visual do Playwright
npm run test:e2e:debug    # modo debug
npm run test:e2e:report   # abre HTML report
```

**Cobertura (~120 cenários):**
- Redirecionamentos e 401 sem autenticação
- Todas as páginas do dashboard carregam
- CRUD completo de projetos, casos, itens, bugs, planos, membros
- Testes de isolamento IDOR entre organizações
- Painel super-admin

---

## CI/CD

GitHub Actions em `.github/workflows/ci.yml`:

1. PostgreSQL 16 efêmero como service
2. `prisma migrate deploy` + `npm run seed`
3. Type check (`tsc --noEmit`)
4. Lint (`npm run lint`)
5. Playwright E2E com upload do HTML report como artefato

Triggers: push e pull request para `master`/`main`.

---

## Migrations (Prisma 7 + Supabase)

O Supabase usa um connection pooler (porta 6543) para runtime, mas DDL requer conexão direta (porta 5432). O `prisma.config.ts` já está configurado para usar `DIRECT_URL` nas migrations.

```bash
# Aplicar migrations pendentes
npx prisma migrate deploy

# Criar nova migration durante desenvolvimento
npx prisma migrate dev --name nome_da_migration
```

> **Atenção:** nunca use o pooler (porta 6543) para migrations — o Supabase Supavisor rejeita DDL nesse modo.

---

## Multi-tenancy e Permissões

Cada organização tem dados completamente isolados por `organizationId`.

| Papel | Permissões |
|-------|-----------|
| **Super Admin** | Acesso ao `/admin`; gerencia todas as orgs |
| **Owner** | Tudo do Admin + configurações da org (dashboards, termos) |
| **Admin** | Vê todos os projetos; convida membros; cria projetos |
| **Member** | Acesso aos projetos onde foi explicitamente adicionado |

Recursos de outras organizações sempre retornam **404** (não 403) para não confirmar existência — proteção contra IDOR.

---

## Segurança

- Senhas hashed com `bcrypt` (cost factor 12)
- RLS habilitado em todas as tabelas no Supabase (migração `20260422000000_enable_rls`)
- Endpoints com guard `findFirst({ id, organizationId })` em vez de `findUnique`
- Testes de isolamento automatizados no CI (`isolation.spec.ts` — 21 cenários IDOR)

---

## Rotas

| Rota | Tela |
|------|------|
| `/` | Dashboard principal |
| `/projects` | Lista de projetos |
| `/projects/[id]` | Detalhe do projeto (tabs: itens, casos, planos, bugs) |
| `/cases` | Casos de teste |
| `/generator` | Gerador IA de casos |
| `/generator/bugs` | Gerador IA de bugs |
| `/executions` | Execuções |
| `/reports` | Relatórios |
| `/bugs` | Bugs |
| `/settings/general` | Configurações gerais + Sobre |
| `/settings/dashboards` | Gerenciamento de dashboards |
| `/settings/terms` | Terminologia personalizada |
| `/settings/members` | Membros da organização |
| `/settings/projects` | Projetos da organização |
| `/settings/generator` | Gerador IA — formatos e padrões |
| `/admin` | Painel super admin — organizações |
| `/admin/admins` | Super admins |
| `/admin/ai` | Configuração do provedor de IA |
| `/api-docs` | Swagger UI (admins/owners) |

---

## Terminologia personalizável

O sistema expõe 12 termos editáveis via **Configurações → Termos**. Os termos são armazenados em `localStorage` por idioma e aplicados em toda a interface dinamicamente.

| Chave | Padrão (pt-BR) |
|-------|---------------|
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



Sem provedor configurado, o gerador retorna casos mockados para não bloquear o fluxo.
