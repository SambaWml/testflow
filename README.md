# TestFlow — Sistema de Gestão de Testes

Sistema web completo para geração, execução e relatório de casos de teste com IA.

## Funcionalidades

- **Dashboard** — visão geral, métricas e taxa de sucesso
- **Itens** — cadastro de US, Bugs, Melhorias, Requisitos, Fluxos e Tarefas
- **Gerador IA** — gera casos de teste BDD ou Step by Step via OpenAI GPT-4o (com mock sem API key)
- **Casos de Teste** — lista, visualização e gerenciamento de todos os casos
- **Execução** — fila de casos, registro de status, evidências e bugs
- **Relatórios** — consolidação de execuções, gráficos e exportação para PDF
- **Configurações** — criação de projetos, módulos e configurações do sistema

## Setup

### Requisitos
- Node.js 20+
- npm

### Instalação

```bash
cd testflow
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

Acesse: http://localhost:3000

**Login demo:** admin@testflow.com / admin123

### Variáveis de ambiente (.env.local)

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="seu-secret-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Opcional — habilita geração IA real (sem isso usa mock)
OPENAI_API_KEY="sk-..."
```

## Geração IA

Sem `OPENAI_API_KEY`: o sistema gera casos mock automaticamente (funcional para testes).

Com `OPENAI_API_KEY`: usa GPT-4o para geração real, contextualizada com a descrição do item.

## PDF

O relatório em PDF abre numa nova aba com layout formatado e `window.print()` automático. Use "Salvar como PDF" no browser.

## Banco de dados

Por padrão usa SQLite (arquivo local `dev.db`). Para produção, troque para PostgreSQL:

```env
DATABASE_URL="postgresql://user:pass@host:5432/testflow"
```

## Stack

- Next.js 16 (App Router) + TypeScript 5
- Prisma 7 + SQLite/LibSQL
- Tailwind CSS 4 + Radix UI (componentes)
- TanStack Query v5 (estado do servidor)
- NextAuth v5 (autenticação)
- OpenAI GPT-4o (geração de casos)
- Recharts (gráficos)

## Telas

| Rota | Tela |
|---|---|
| `/` | Dashboard |
| `/items` | Cadastro de Itens |
| `/generator` | Gerador de Casos IA |
| `/cases` | Lista de Casos |
| `/executions` | Execução de Testes |
| `/reports` | Relatórios |
| `/settings` | Configurações |
