# Features, papéis e workflows — TestFlow

Este doc descreve a **ideia do produto**, quais features existem, os papéis (roles) e suas permissões, e os fluxos de trabalho principais — com ênfase em como **workspaces (organizações) e usuários** são criados e convidados.

---

## 1. A ideia do TestFlow

Plataforma SaaS **multi-tenant** para times de QA gerenciarem o ciclo completo de teste de software: cadastrar o que precisa ser testado, gerar casos de teste com ajuda de IA, organizar em planos, executar, registrar evidências e consolidar relatórios.

A metáfora é de um **workspace por cliente/empresa**: cada Organização é um silo de dados. Dentro dela, projetos agrupam o trabalho, módulos agrupam features, e os casos de teste ficam versionados e reutilizáveis.

Três perfis usam o sistema:
1. **Super Admin da plataforma** — quem opera o TestFlow (time interno). Cria organizações, gerencia outros super admins, configura a IA global.
2. **Owner / Admin de uma organização** — dono ou gerente do workspace do cliente. Convida membros, cria projetos, configura dashboards/termos/papéis.
3. **Membro / Viewer** — QA / dev / stakeholder que executa testes, cria casos, consulta relatórios dentro dos projetos aos quais pertence.

---

## 2. Papéis e permissões

### 2.1 Camada global (plataforma)

| Flag | Significado |
|---|---|
| `User.isSuperAdmin: boolean` | Acesso ao painel `/admin`, bypass de todas as regras multi-tenant. |

Super admin **não** participa de organizações por padrão — ele só opera o painel global. Se tentar acessar `/`, `/projects`, etc., o `src/proxy.ts` o redireciona para `/admin`.

### 2.2 Camada da organização (`OrgMember.role`)

| Role | Pode convidar membros | Pode criar/deletar projetos | Pode editar dashboards/termos | Vê quais projetos |
|---|---|---|---|---|
| `OWNER` | ✅ | ✅ | ✅ | Todos da org |
| `ADMIN` | ✅ | ✅ | ❌ | Todos da org |
| `MEMBER` | ❌ | ❌ | ❌ | Só os vinculados em `ProjectMember` |
| `VIEWER` | ❌ | ❌ | ❌ | Só os vinculados em `ProjectMember`, sem edição |

Regra-chave em `src/lib/permissions.ts`:
```ts
// OWNER/ADMIN → null (veem tudo)
// MEMBER/VIEWER → lista explícita de projectIds
export async function getProjectsForUser(userId, orgId, orgRole): Promise<string[] | null> { ... }
```

### 2.3 Camada do projeto (`ProjectMember.role`)

Usado **apenas** para MEMBER/VIEWER, que precisam ser explicitamente adicionados a cada projeto. OWNER/ADMIN enxergam todos sem precisar ser membro do projeto.

### 2.4 Efeitos práticos por rota

Exemplos do que já existe no código:

| Operação | Mínimo exigido | Onde é checado |
|---|---|---|
| Criar organização | `isSuperAdmin` | `POST /api/admin/orgs` |
| Listar organizações (plataforma) | `isSuperAdmin` | `GET /api/admin/orgs` |
| Convidar membro | `OWNER` ou `ADMIN` | `POST /api/orgs/members` |
| Remover membro | `OWNER` ou `ADMIN` | `DELETE /api/orgs/members/[memberId]` |
| Resetar senha de membro | `OWNER` ou `ADMIN` | `POST /api/orgs/members/[memberId]/reset-password` |
| Criar projeto | `OWNER` ou `ADMIN` | `POST /api/orgs/projects` |
| Ver settings/members, settings/projects | `OWNER` ou `ADMIN` | `src/proxy.ts` redireciona outros |
| Ver settings/dashboards, settings/terms | `OWNER` only | `src/components/layout/sidebar.tsx` esconde para ADMIN e abaixo (via `ownerOnly: true`) |
| Ver Dashboard QA | `OWNER` ou `ADMIN` | `src/app/(dashboard)/page.tsx` (`canAccessQA`) |
| Ver lista de membros completa | `OWNER` ou `ADMIN` | `GET /api/orgs/members` devolve subset para MEMBER |

---

## 3. Workflow completo — do nada a um usuário produtivo

Este é **o fluxo principal do produto** e é onde mais gente se perde. Três atos.

### Ato 1 — Super Admin cria a organização (workspace)

O super admin loga em `superadmin@testflow.com` (ou outro criado via `/admin/admins`) e vai em **Painel Admin → Organizações**.

1. Clica **"Nova organização"**, preenche:
   - Nome da organização (ex: "Acme Corp")
   - Nome e e-mail do **primeiro owner**
   - Plano (`FREE` / `PRO` / ...)
   - Opcional: senha inicial (senão é gerada aleatoriamente)
   - Opcional: marcar "enviar e-mail de boas-vindas"
2. O backend (`POST /api/admin/orgs`) executa uma transação:
   - Gera `slug` a partir do nome (normaliza acentos, kebab-case).
   - Gera `code` sequencial começando em 1001.
   - Cria `Organization`.
   - Se o e-mail do owner **não existia**, cria `User` com role global `"ADMIN"` e `passwordHash` (bcrypt 12 rounds).
   - Se existia, atualiza `passwordHash` com a senha temporária fornecida.
   - Cria `OrgMember` com `role: "OWNER"` e `joinedAt: now()`.
3. Se SMTP estiver configurado, envia `sendWelcomeEmail` com as credenciais.
4. Se e-mail falhar **ou** o admin marcou "não enviar", a resposta JSON vem com `tempPassword` — o super admin anota e passa manualmente.

Resultado: a organização existe, tem um dono com login e senha.

> **Importante:** o campo `User.role` ("ADMIN"/"TESTER") é legado e quase não é usado. A permissão que importa é `OrgMember.role` dentro de cada org.

### Ato 2 — Owner entra, configura e convida membros

O owner faz login em `/login`. Primeiro acesso normalmente:

1. **Configura a organização** em `/settings/general`:
   - Nome de exibição, idioma padrão (pt-BR / en-US), logo.
2. **(Opcional) Personaliza termos** em `/settings/terms`:
   - Renomeia "Projeto" para "Squad", "Bug" para "Defeito", etc. (armazenado em `localStorage` por idioma, não na API — então o user que logar em outro dispositivo começa com defaults).
3. **(Opcional) Personaliza nomes de papéis** — `Organization.roleNames` é um JSON: `{"OWNER":"Owner","ADMIN":"Admin","MEMBER":"Membro"}`. Endpoint `GET/PUT /api/orgs/role-names`. Afeta rótulos na UI (sidebar mostra "Admin" ou o nome custom).
4. **(Opcional) Configura dashboards** em `/settings/dashboards`:
   - Ativa/desativa "Visão Geral" (`overviewEnabled`), renomeia.
   - Ativa/desativa "Dashboard QA" (`qaDashboardEnabled`), renomeia.
5. **Cria projetos** em `/settings/projects`:
   - Nome, descrição, slug único global.
   - O proprietário do endpoint (`POST /api/orgs/projects`) injeta automaticamente o `organizationId` corrente.
6. **Convida membros** em `/settings/members`:
   - Preenche nome, e-mail, role (`MEMBER` default).
   - Se o e-mail **não existia** como user na plataforma, é criado com `passwordHash` aleatório e `role: "TESTER"` global.
   - Se **já existia** (pode ser owner de outra org), o endpoint **não cria** nova senha — só adiciona `OrgMember`. (Na prática isso permite um usuário pertencer a múltiplas orgs, mas a UI hoje só mostra a **primeira** org no login — ver seção 3.4.)
   - `POST /api/orgs/members` tenta enviar `sendWelcomeEmail`; se SMTP não está configurado, devolve `tempPassword` no JSON.
7. **(Opcional) Vincula membros a projetos específicos**:
   - Em `/settings/projects/[id]/members` (via `POST /api/orgs/projects/[id]/members`).
   - Obrigatório para `MEMBER`/`VIEWER` conseguirem ver qualquer projeto. OWNER e ADMIN enxergam tudo sem precisar disso.

### Ato 3 — Membro loga, faz o trabalho

1. Membro recebe e-mail (ou senha copiada do owner), loga em `/login`.
2. NextAuth busca o user, acha o **primeiro** `OrgMember` e embute `orgId/orgRole` no JWT.
3. `src/proxy.ts`:
   - Tem sessão ✓
   - Não é super admin ✓
   - Tem `orgId` ✓ → libera para `/`.
4. Dashboard carrega (só "Visão Geral" se não for owner/admin).
5. Menu lateral mostra:
   - **Sempre**: Dashboard, Projetos, Bugs, Generator IA, Casos, Execuções, Relatórios.
   - **Owner/Admin**: adicionalmente submenus de Settings que incluem Projetos e Dashboards/Termos.
   - **Super Admin**: link extra "Painel Admin" (só aparece pra ele, mas o `/admin` fica em rota separada).
6. MEMBER/VIEWER: toda listagem é automaticamente filtrada pelos projetos onde têm `ProjectMember`.

### 3.4 Casos de borda — e o que o sistema faz

| Cenário | Comportamento atual |
|---|---|
| Usuário não está em nenhuma org | `src/proxy.ts` redireciona para `/pending` (tela "aguarde acesso"). |
| Usuário está em várias orgs | NextAuth pega sempre o **primeiro** `OrgMember` retornado pelo Prisma. Não há troca de org via UI. |
| Super admin também é owner de uma org | O `proxy.ts` força ele a ir pra `/admin`. Ele não consegue ver a org normalmente enquanto for super admin. |
| Owner quer trocar a senha | `/api/user/profile` PATCH com `currentPassword` + `newPassword`. |
| Admin quer resetar senha de um membro | `POST /api/orgs/members/[memberId]/reset-password` gera nova senha aleatória e tenta enviar por e-mail via `sendPasswordResetEmail`. |
| Usuário é removido da org | `DELETE /api/orgs/members/[memberId]` apaga `OrgMember`. O `User` continua existindo (pode pertencer a outras orgs). |
| Membro tenta acessar `/settings/projects` | `proxy.ts` redireciona para `/` (não é Owner/Admin). |
| Membro tenta abrir um projeto que não pertence a ele | API retorna 404 (por `organizationId` ou `projectId IN allowed[]`). |
| SMTP não configurado | Endpoint devolve `tempPassword` no JSON — admin copia manualmente. |

---

## 4. Features em detalhe

### 4.1 Dashboard (rota `/`)

Duas abas, cada uma ativada por flag da organização:

- **Visão Geral** (`overviewEnabled`) — para todos:
  - KPIs: total de itens, casos, execuções, taxa de aprovação.
  - Pie chart de status de execuções.
  - Quick actions: ir para Projetos, Generator, Execuções, Relatórios.
  - Últimos planos e relatórios.
- **Dashboard QA** (`qaDashboardEnabled`, só OWNER/ADMIN) — analytics:
  - Filtros: período, projeto, membro, prioridade, status de bug.
  - Sub-abas: "Visão Geral", "Por QA", "Por Projeto", "Por Bug".
  - Gráficos: bugs por status/prioridade, plans/reports por membro, cards por projeto.

Nomes das abas são customizáveis em `/settings/dashboards`.

### 4.2 Projetos e módulos (rota `/projects` e `/settings/projects`)

- **`/projects`** — lista os projetos visíveis, cada um abre itens (user stories, bugs, melhorias…).
- **`/settings/projects`** (OWNER/ADMIN) — CRUD:
  - Criar projeto (`name`, `description`, `slug` global).
  - Deletar projeto → bloqueia com 409 se houver itens/casos/execuções (validação negocial documentada em `AGENTS.md`).
  - Gerenciar módulos via `POST /api/projects/[id]/modules`.
  - Gerenciar membros do projeto (para MEMBER/VIEWER).

Projeto → módulos → itens → casos: é uma árvore hierárquica. Módulo é opcional mas ajuda a organizar.

### 4.3 Items (User Stories, Bugs, Requisitos — rota `/items` e dentro de `/projects`)

`Item.type` aceita: `USER_STORY`, `BUG`, `MELHORIA`, `REQUISITO`, `FLUXO`, `TAREFA` (configurável via `src/lib/enum-config.ts`).

Campos: `title`, `description`, `reference` (código externo tipo JIRA-123), `acceptanceCriteria`, `notes`, `priority`, `status`, `moduleId?`, `authorId`.

Serve principalmente como **insumo de geração IA** — um item descreve o que precisa ser testado; o gerador lê ele e cria casos.

### 4.4 Casos de teste (rota `/cases`)

- **Biblioteca** visível conforme permissão (OWNER/ADMIN veem todos; MEMBER só os de seus projetos).
- Duas formas: `BDD` (`Given / When / Then`) e `STEP_BY_STEP` (`TestStep[]` numerados + `expectedResult`).
- Campos principais: `title`, `priority`, `precondition`, `tags[]` (JSON string), `reference`, vínculos com `Item` e `Module`.
- **Soft delete** via `isActive: false` — jamais apagar hard.
- **Versionamento** via `version: Int` — incrementado automaticamente no PATCH.
- Visualizações em lista e grade, filtros por projeto/formato/prioridade, ações em lote (`DELETE /api/cases/bulk` marca vários como `isActive: false`).

### 4.5 Gerador de IA (rota `/generator`)

Feature central do produto. Três provedores suportados em cascata:

| Provedor | Endpoint externo | Modelo padrão |
|---|---|---|
| Claude (Anthropic) | `POST /messages` | `claude-sonnet-4-6` |
| Manus AI | Task async + polling | `claude-sonnet-4-5` |
| OpenAI | `POST /chat/completions` | `gpt-4o` |

Configuração em `src/lib/ai-config.ts`: lê `Setting` com chave `ai_provider_config`; fallback para env vars na ordem `ANTHROPIC_API_KEY > MANUS_API_KEY > OPENAI_API_KEY`. Sem nada, devolve **mocks** (preserva o fluxo em dev).

**Fluxo de geração (`POST /api/cases/generate`):**
1. User seleciona um `Item` existente **ou** descreve manualmente.
2. Escolhe quantidade (1–30), formato (BDD/STEP_BY_STEP), linguagem, nível de cobertura, tipo de teste (functional/regression/smoke/e2e/negative/performance).
3. Backend monta prompt, chama o provedor, parseia JSON com sanitização robusta (remove trailing commas, extrai JSON balanceado).
4. Registra `GenerationLog` para auditoria.
5. Devolve `{ cases: [...] }` — **não grava em `TestCase`**, é preview.
6. Usuário revisa/edita → confirma → `POST /api/cases/bulk` salva os casos escolhidos.
7. Pode (opcionalmente) criar um `TestPlan` já com esses casos.

Existe também o **gerador de bugs** em `/generator/bugs` — mesma estrutura, com categorias (`functional`, `ui`, `performance`, `security`, `integration`, `data`, `accessibility`).

### 4.6 Planos de teste e execuções (rota `/executions`)

**Plano de teste** (`TestPlan`) é um agrupamento ordenado de casos para uma rodada (ambiente/build):
- `POST /api/test-plans` cria o plano e os `TestPlanCase` em ordem.
- Status do plano: `PENDING` → `IN_PROGRESS` → `COMPLETED`.

**Execução** (`Execution`) é o registro de rodar um caso específico:
- `POST /api/executions` com `caseId`, `testPlanId?`, `status`, `environment`, `buildVersion`, `notes`, `relatedBugRef`, `duration`.
- Status: `NOT_EXECUTED`, `PASS`, `FAIL`, `BLOCKED`, `RETEST`, `SKIPPED`.
- Evidências: `Evidence[]` — arquivos (upload via `POST /api/upload`) ou URLs.

**Execução caso-a-caso**:
- A página `/executions/[id]` navega pelos casos do plano em sequência mantendo rascunhos entre cada caso (ver README).
- Cada caso pode ter várias evidências anexadas.

**Permissões**:
- Qualquer membro do projeto pode criar/editar suas próprias execuções.
- OWNER/ADMIN veem todas.

### 4.7 Relatórios (rota `/reports`)

Consolidação de execuções de um plano:
- `POST /api/reports` cria `Report` + `ReportItem[]` (um por execução).
- Calcula: `passRate`, contagem de `executed`, distribuição por status.
- Campos: `title`, `projectId`, `authorId`, `environment`, `buildVersion`, `dateFrom/dateTo`, `notes`.
- **Exporta para PDF** em `GET /api/reports/[id]/pdf` — usa `@react-pdf/renderer` com layout customizado (pie chart de status, lista de casos, evidências).
- **Exporta para Markdown** — botão no cliente serializa o relatório.

### 4.8 Bugs (rota `/bugs`)

Tracker simples, independente do item do tipo `BUG`:
- `Item.type = "BUG"` é o registro tradicional.
- Lista com filtro por projeto, status, prioridade.
- `/generator/bugs` gera descrições estruturadas de bug a partir de sintoma + contexto.

### 4.9 Configurações (rota `/settings`)

| Aba | Acesso | O que faz |
|---|---|---|
| **Geral** | Todos | Nome da org, idioma, aba "Sobre" (glossário e tech). |
| **Dashboards** | OWNER | Toggle e rename de "Visão Geral" e "Dashboard QA". |
| **Termos** | OWNER | Customiza 12+ termos (projeto, bug, casoDeTeste, etc.). Armazenado em `localStorage` por idioma. |
| **Membros** | OWNER / ADMIN | Convida (gera senha + e-mail), remove, reseta senha, vincula a projetos. |
| **Projetos** | OWNER / ADMIN | CRUD + vincular membros. |
| **Gerador IA** | Todos | Ver status do provedor ativo. |
| **Sobre** | Todos | Glossário, stack, tips. |

### 4.10 Painel Super Admin (rota `/admin`)

Só visível com `isSuperAdmin`. Três subpainéis:

- **Organizações** (`/admin/orgs`) — lista com contagem de membros/projetos, cria nova org (seção 3), ativa/desativa, exclui.
- **Super Admins** (`/admin/admins`) — promove/remove outros usuários como super admin.
- **Configuração IA** (`/admin/ai`) — define provedor ativo, cola API keys, configura modelos. Persiste em `Setting.value`.

---

## 5. O que cada role vê na navegação

### Sidebar (`src/components/layout/sidebar.tsx`)

Links da parte "Workspace" (sempre visíveis para membros da org):
- Dashboard, Projetos, Bugs, Generator IA, Casos, Execuções, Relatórios.

Submenu de "Configurações":
- **Todos**: Membros (com restrições), Geral, Gerador IA.
- **OWNER only** (flag `ownerOnly: true` no código): Projetos, Dashboards, Termos.

Link extra **"Painel Admin"** — só aparece se `session.user.isSuperAdmin`.

### Topbar (`src/components/layout/topbar.tsx`)

Toggle de tema (dark/light), sino de notificações (placeholder — polling futuro), dropdown do perfil com:
- **Meu perfil** — dialog que permite trocar nome, e-mail e senha (`PATCH /api/user/profile`).
- **Sair** — `signOut()` do NextAuth.

### O que cada role pode de fato fazer

| Ação | SUPER | OWNER | ADMIN | MEMBER | VIEWER |
|---|---|---|---|---|---|
| Criar/excluir organização | ✅ | — | — | — | — |
| Promover super admin | ✅ | — | — | — | — |
| Configurar IA global | ✅ | — | — | — | — |
| Ver dashboard / usar app da org | — | ✅ | ✅ | ✅ (só projetos vinculados) | ✅ (só projetos vinculados) |
| Ver Dashboard QA | — | ✅ | ✅ | ❌ | ❌ |
| Renomear papéis/termos/dashboards | — | ✅ | ❌ | ❌ | ❌ |
| Convidar/remover membros | — | ✅ | ✅ | ❌ | ❌ |
| Criar/excluir projeto | — | ✅ | ✅ | ❌ | ❌ |
| Criar/editar casos | — | ✅ | ✅ | ✅ | ❌ |
| Gerar casos via IA | — | ✅ | ✅ | ✅ | ❌ |
| Criar planos e executar | — | ✅ | ✅ | ✅ | ❌ |
| Gerar relatório | — | ✅ | ✅ | ✅ | ❌ |
| Visualizar casos/execuções/relatórios | — | ✅ | ✅ | ✅ | ✅ |

> VIEWER não tem uma rota exclusiva — na prática, hoje o projeto usa MEMBER como default. VIEWER existe como possibilidade de papel em `ProjectMember` quando se quer alguém só-leitura.

---

## 6. Glossário dos termos customizáveis

Tudo isso está em `src/lib/term-config.ts` e é editável em `/settings/terms`. Cada termo tem singular e plural.

| Chave | Padrão pt-BR (singular / plural) | O que é |
|---|---|---|
| `projeto` | Projeto / Projetos | Agrupador principal do trabalho. |
| `bug` | Bug / Bugs | Defeito encontrado. |
| `relatorio` | Relatório / Relatórios | Consolidação de execuções. |
| `execucao` | Execução / Execuções | Registro de rodar um caso. |
| `casoDeTeste` | Caso de Teste / Casos de Teste | Teste (BDD ou step-by-step). |
| `planoDeTeste` | Plano de Teste / Planos de Teste | Conjunto de casos para uma rodada. |
| `item` | Item / Itens | User story / bug / requisito (insumo do gerador). |
| `membro` | Membro / Membros | Usuário da org. |
| `ambiente` | Ambiente / Ambientes | QA, staging, produção. |
| `build` | Build / Versão | Identificador da versão testada. |
| `evidencia` | Evidência / Evidências | Print, log, URL anexada. |
| `bugRelacionado` | Bug Relacionado / Bugs Relacionados | Referência a um bug externo. |
| `preCondicao` | Pré-condição / Pré-condições | Setup esperado antes da execução. |
| `qaOverview` | Visão Geral | Aba 1 do Dashboard QA. |
| `porQA` | Por QA | Aba 2 do Dashboard QA. |
| `porProjeto` | Por Projeto / Por Projetos | Aba 3 do Dashboard QA. |
| `porBug` | Por Bug / Por Bugs | Aba 4 do Dashboard QA. |

Existe também um dicionário completo de defaults em inglês (`DEFAULT_TERMS_EN`). A troca é por idioma selecionado em `localStorage.testflow_lang`.

---

## 7. Fluxo completo em 1 página (referência rápida)

```
[Super Admin]                                          [Owner]                                       [Member]
     │                                                    │                                             │
     │ /admin/orgs → "Nova organização"                   │                                             │
     │   • gera slug, code, cria Org                      │                                             │
     │   • cria/atualiza User(owner)                      │                                             │
     │   • cria OrgMember(role=OWNER)                     │                                             │
     │   • envia e-mail ou devolve tempPassword           │                                             │
     │────────────────────────────────────────────────────▶ recebe credenciais                        │
     │                                                    │                                             │
     │                                                    │ /login → cai no dashboard                   │
     │                                                    │                                             │
     │                                                    │ /settings/general (nome, idioma)            │
     │                                                    │ /settings/dashboards (flags)                │
     │                                                    │ /settings/terms (custom labels)             │
     │                                                    │ /settings/projects → cria Project           │
     │                                                    │ /settings/members → convida                 │
     │                                                    │   • POST /api/orgs/members                  │
     │                                                    │   • cria User + OrgMember(role=MEMBER)      │
     │                                                    │   • envia welcome email                     │
     │                                                    │────────────────────────────────────────────▶ recebe credenciais
     │                                                    │                                             │
     │                                                    │ /settings/projects/[id]/members             │ /login → dashboard (Visão Geral)
     │                                                    │   • cria ProjectMember para MEMBER/VIEWER  │
     │                                                    │                                             │ /projects → só vê vinculados
     │                                                    │                                             │ /generator → gera casos
     │                                                    │                                             │ /executions → executa plano
     │                                                    │                                             │ /reports → consolida
     │                                                    │                                             │
     │                                                    ◀─── execução concluída ───────────────────────│
     │                                                    │ Relatório / Dashboard QA                    │
```

---

## 8. Segurança — resumo do modelo

1. **Autenticação**: NextAuth JWT (`session: { strategy: "jwt" }`). Token contém `id`, `isSuperAdmin`, `orgId`, `orgRole`.
2. **Gate global**: `src/proxy.ts` faz primeiro filtro (401/redirect).
3. **Gate por rota**: cada `route.ts` extrai `sessionUser(session.user)` e compara papéis.
4. **Isolamento multi-tenant**: `organizationId` em **toda** query. 404 (nunca 403) para recursos de outra org.
5. **Isolamento por projeto**: `getProjectsForUser` injeta `projectId IN [...]` para MEMBER/VIEWER.
6. **Senhas**: bcrypt 12 rounds em produção (10 no seed). Nunca expostas no JSON, exceto `tempPassword` no momento da criação quando o e-mail falhou.
7. **Supabase RLS**: habilitado no banco (doc em `AGENTS.md`), mas como Prisma usa **service role**, o RLS não bloqueia nada — a regra real é no código.

---

## 9. Para debugar rapidamente quem pode o quê

Três perguntas sempre úteis:

1. **"Esse usuário está logado?"** — cheque `session?.user` na rota.
2. **"Ele é super admin?"** — `u.isSuperAdmin` bypassa tudo em rotas `/api/admin/*`. Em rotas de org, normalmente não aparece (ele é redirecionado antes).
3. **"Qual é o `orgRole` dele?"** — OWNER/ADMIN veem tudo; MEMBER/VIEWER só veem `projectId IN getProjectsForUser(...)`.

Use o Prisma Studio (`npm run db:studio`) para conferir a `OrgMember` e `ProjectMember` do usuário em questão — essas duas tabelas respondem 90% das dúvidas de permissão.

---

## 10. Para onde ir agora

- Entender a arquitetura geral → `docs/01-arquitetura.md`
- Subir o projeto localmente → `docs/02-setup.md`
- Como código se organiza (Next/React/Prisma) → `docs/03-estrutura.md`
- Regras obrigatórias para código novo → `AGENTS.md` e `CLAUDE.md`
- Deploy em produção → `DEPLOY.md`
