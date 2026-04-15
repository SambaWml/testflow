# TestFlow

Plataforma web multi-tenant para planejamento, execução e reporte de testes de software — com geração de casos de teste via IA e painel de super-administração.

---

## Funcionalidades

### Módulos principais

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | Visão geral com KPIs, gráfico de status, taxa de aprovação e ações rápidas. Dashboard QA com filtros por período, membro, projeto e prioridade. |
| **Projetos** | Organiza itens e casos de teste por projeto. Suporte a múltiplos tipos de item (User Story, Bug, Melhoria, Requisito, Fluxo, Tarefa). |
| **Casos de Teste** | Visualização em lista ou grade, filtros por projeto/formato/prioridade, exclusão em lote. |
| **Gerador IA** | Geração de casos BDD ou Step-by-Step via IA. Suporte a OpenAI, Manus AI e Claude. Pode criar Plano de Teste diretamente após a geração. |
| **Execuções** | Executa planos de teste caso a caso, registra status, notas, bugs relacionados e múltiplos links de evidência. Permite navegar para casos anteriores mantendo os rascunhos. |
| **Relatórios** | Consolida execuções, exibe estatísticas de aprovação/reprovação, exporta para PDF ou copia como Markdown. |
| **Bugs** | Registro e acompanhamento de bugs com status, prioridade e projeto. |

### Configurações

| Submenu | Descrição |
|---------|-----------|
| **Geral** | Nome da organização, idioma (pt-BR / en-US) e aba "Sobre" com informações da plataforma. |
| **Dashboards** | Ativa/desativa e renomeia os dashboards "Visão Geral" e "Dashboard QA" (somente Owner). |
| **Termos** | Personaliza os 12 termos do sistema (singular e plural) — ex.: renomear "Bug" para "Defeito". |
| **Membros** | Convida, visualiza e remove membros da organização. |
| **Projetos** | Gerencia os projetos da organização, incluindo exclusão com contagem de itens vinculados. |

### Painel Super Admin (`/admin`)

| Seção | Descrição |
|-------|-----------|
| **Organizações** | Lista, cria, ativa/desativa e exclui organizações. |
| **Super Admins** | Gerencia contas com acesso ao painel de administração. |
| **Configuração IA** | Define o provedor de IA ativo (OpenAI / Manus AI / Claude) e suas chaves de API e modelos. |

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
| Auth | NextAuth v5 (JWT) |
| ORM | Prisma 7 |
| Banco | PostgreSQL (Supabase) |
| IA | OpenAI SDK / Manus AI / Anthropic Claude |
| Gráficos | Recharts |
| PDF | @react-pdf/renderer |
| Email | Nodemailer (SMTP) |

---

## Setup local

### Requisitos

- Node.js 20+
- Banco PostgreSQL (ex.: Supabase)

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
# ANTHROPIC_API_KEY="sk-ant-..."
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

**Login super admin:** `superadmin@testflow.com` / `superadmin123`  
**Login demo:** `admin@testflow.com` / `admin123`

---

## Migrations (Prisma 7 + Supabase)

O Supabase usa um connection pooler (porta 6543) para runtime, mas DDL (CREATE TABLE, ALTER TABLE) requer conexão direta (porta 5432). O `prisma.config.ts` já está configurado para usar `DIRECT_URL` nas migrations.

```bash
# Aplicar migrations pendentes
npx prisma migrate deploy

# Criar nova migration durante desenvolvimento
npx prisma migrate dev --name nome_da_migration

# Sincronizar schema sem gerar arquivo de migration (não recomendado em produção)
npx prisma db push
```

> **Atenção:** nunca use o pooler (porta 6543) para migrations — o Supabase Supavisor rejeita DDL nesse modo.

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
| `build` | Build / Versão / Builds / Versões |
| `evidencia` | Evidência / Evidências |
| `bugRelacionado` | Bug Relacionado / Bugs Relacionados |
| `preCondicao` | Pré-condição / Pré-condições |

---

## Provedores de IA

A configuração do provedor ativo é feita pelo Super Admin em `/admin/ai`. Fallback para variáveis de ambiente se não houver configuração no banco.

| Provedor | Modelo padrão | Env var |
|----------|--------------|---------|
| OpenAI | `gpt-4o` | `OPENAI_API_KEY` |
| Manus AI | `claude-sonnet-4-5` | `MANUS_API_KEY` + `MANUS_BASE_URL` |
| Claude (Anthropic) | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |

Sem provedor configurado, o gerador retorna casos de teste mockados para não bloquear o fluxo.

---

## Rotas

| Rota | Tela |
|------|------|
| `/` | Dashboard principal |
| `/projects` | Projetos e itens |
| `/cases` | Casos de teste |
| `/generator` | Gerador IA |
| `/executions` | Execuções |
| `/reports` | Relatórios |
| `/bugs` | Bugs |
| `/settings/general` | Configurações gerais + Sobre |
| `/settings/dashboards` | Gerenciamento de dashboards |
| `/settings/terms` | Terminologia personalizada |
| `/settings/members` | Membros da organização |
| `/settings/projects` | Projetos da organização |
| `/admin` | Painel super admin — organizações |
| `/admin/admins` | Super admins |
| `/admin/ai` | Configuração do provedor de IA |

---

## Multi-tenancy

Cada organização tem membros com papéis:

| Papel | Permissões |
|-------|-----------|
| `OWNER` | Acesso total, incluindo configurações de dashboards e termos |
| `ADMIN` | Gerencia membros, projetos e execuções |
| `MEMBER` | Acesso de leitura e execução |

Super Admins têm acesso ao painel `/admin` independentemente de pertencer a uma organização.
