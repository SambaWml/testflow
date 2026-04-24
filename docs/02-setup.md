# Setup — rodando o TestFlow localmente

Guia passo-a-passo para tirar o projeto do zero na sua máquina, conectar ao Supabase, aplicar o schema com Prisma e subir o servidor de desenvolvimento. Tudo funciona com um único comando por etapa.

> **Tempo estimado:** 15 a 30 minutos, contando a criação de conta no Supabase.

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como verificar |
|---|---|---|
| Node.js | **20 LTS ou superior** | `node -v` |
| npm | 10+ (vem com Node 20) | `npm -v` |
| Git | qualquer recente | `git --version` |
| Conta Supabase | plano grátis serve | https://supabase.com |
| (opcional) SMTP | Gmail com senha de app, Resend, etc. | — |
| (opcional) Chave IA | OpenAI, Anthropic ou Manus | — |

Não é necessário instalar Postgres localmente — o Supabase fornece o banco.

---

## 2. Clonar e instalar dependências

```bash
git clone <url-do-repo> testflow
cd testflow
npm install
```

O `postinstall` roda `prisma generate` automaticamente, então não precisa rodar manualmente depois. Se algo der errado, rode `npx prisma generate` à mão.

---

## 3. Criar o banco no Supabase

1. Acesse https://supabase.com e faça login (GitHub é o mais rápido).
2. Clique em **New project**.
3. Preencha:
   - **Name**: `testflow-dev` (ou o que preferir)
   - **Database Password**: crie uma senha forte e **guarde em lugar seguro**
   - **Region**: `South America (São Paulo)` se os usuários são do Brasil
4. Clique em **Create new project** e espere ~2 minutos até o banco ficar verde.

### Copiar as duas connection strings

O TestFlow precisa de **duas URLs diferentes** porque o Supabase separa:
- **Pooler (Supavisor)** porta `6543` → usado em runtime, rejeita DDL.
- **Direct connection** porta `5432` → usado para rodar migrations.

No painel do Supabase:

1. Clique no botão **Connect** no topo da tela.
2. Na aba **"Transaction pooler"** → copie a string (substitua `[YOUR-PASSWORD]` pela senha criada).
   - Essa é a sua `DATABASE_URL`.
3. Na aba **"Direct connection"** → copie a outra string.
   - Essa é a sua `DIRECT_URL`.

As duas strings têm essa aparência:
```
postgresql://postgres.xxxxxxxxxxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres   # pooler (runtime)
postgresql://postgres:SENHA@db.xxxxxxxxxxxx.supabase.co:5432/postgres                        # direct (migrations)
```

---

## 4. Configurar variáveis de ambiente (`.env.local`)

Crie o arquivo `.env.local` na **raiz do projeto** (mesmo nível de `package.json`):

```env
# ── Banco de dados ──────────────────────────────────────────
# Runtime (pooler, porta 6543)
DATABASE_URL="postgresql://postgres.xxxxxxxxxxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# Migrations (direct, porta 5432)
DIRECT_URL="postgresql://postgres:SENHA@db.xxxxxxxxxxxx.supabase.co:5432/postgres"

# ── Autenticação (NextAuth) ────────────────────────────────
# Gere com: openssl rand -base64 32
NEXTAUTH_SECRET="cole-aqui-um-secret-longo-e-aleatorio"
NEXTAUTH_URL="http://localhost:3000"

# ── E-mail (opcional em dev — necessário para convites) ────
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=seu@gmail.com
# SMTP_PASS=senha-de-app-do-gmail
# SMTP_FROM="TestFlow <seu@gmail.com>"

# ── IA (opcional — sem chave, o gerador usa mocks) ─────────
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# MANUS_API_KEY=...
# MANUS_BASE_URL=https://api.manus.ai
```

### Gerando o `NEXTAUTH_SECRET`

Qualquer um destes funciona:
```bash
openssl rand -base64 32
# ou:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Observações

- **Não commit** `.env.local`. O `.gitignore` já ignora.
- `DIRECT_URL` só é lida pelo `prisma.config.ts` durante migrations. Runtime usa apenas `DATABASE_URL`.
- O `prisma.config.ts` lê `.env.local` automaticamente em dev e `.env.production` quando `DEPLOY_ENV=production`.

---

## 5. Aplicar o schema ao Supabase

```bash
npx prisma migrate deploy
```

O que isso faz:
- Lê `prisma/migrations/` (8 migrations existentes — `init`, adição de organizations, org code, role names, dashboard features, etc.).
- Aplica todas em ordem contra a `DIRECT_URL`.
- Resultado esperado: `All migrations have been successfully applied.`

Se der erro de SSL com o Supabase:
- Confirme que a URL contém `supabase.com` — o código em `src/lib/prisma.ts` habilita SSL só nesse caso.
- Se a `DIRECT_URL` estiver errada, o erro típico é `PrismaClientInitializationError: Can't reach database server`.

### Rodando migrations futuras (quando o schema mudar)

```bash
# Durante desenvolvimento, cria um novo arquivo em prisma/migrations/
npx prisma migrate dev --name nome_da_mudanca

# Em produção (ou para só aplicar as pendentes, sem criar novas)
npx prisma migrate deploy
```

**Não use `npx prisma db push`** em banco compartilhado — ele sincroniza o schema sem histórico e quebra o versionamento (regra documentada em `AGENTS.md`).

---

## 6. Popular o banco com dados iniciais (`seed`)

```bash
npm run seed
```

Isso executa `prisma/seed.ts` via `tsx` e cria:

| Tipo | Email | Senha | Observação |
|---|---|---|---|
| Super Admin | `superadmin@testflow.com` | `admin123` | Acesso ao painel `/admin`, sem org. |
| Org Owner | `admin@testflow.com` | `admin123` | Dono da "Demo Org" (`demo-org`). |

Além disso, cria:
- **Demo Org** (`code: 1001`, plano PRO)
- **Projeto Demo** com módulo `Autenticação`
- **Item US-001** (Login de Usuário)
- **3 casos de teste** (2 BDD + 1 STEP_BY_STEP com 6 passos)
- **2 execuções** (1 PASS + 1 FAIL com bug ref)

Use essas credenciais apenas em dev. Troque antes de qualquer deploy.

---

## 7. Subir o servidor de desenvolvimento

```bash
npm run dev
```

Saída esperada:
```
▲ Next.js 16.2.2
- Local:   http://localhost:3000
✓ Ready in ~3s
```

Acesse http://localhost:3000 e faça login com uma das contas do seed.

---

## 8. Comandos disponíveis

| Comando | Quando usar |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot reload. |
| `npm run build` | Build de produção — **roda `prisma generate && next build`**, não aplica migrations. |
| `npm start` | Serve o build de produção (precisa rodar `npm run build` antes). |
| `npm run lint` | ESLint flat config (`eslint.config.mjs`). |
| `npm run seed` | Popula o banco com dados de exemplo. |
| `npm run db:push` | Alias para `npx prisma migrate dev` — **só em dev**. |
| `npm run db:studio` | Abre o Prisma Studio em http://localhost:5555 para explorar as tabelas. |
| `npx prisma migrate deploy` | Aplica migrations pendentes — use também em CI/produção. |
| `npx prisma generate` | Regenera o cliente Prisma após editar `schema.prisma`. |
| `npx prisma migrate reset` | **Destrói** o banco e reaplica tudo do zero + seed. Só use em dev. |

Não existe `npm test` — o projeto não tem runner de testes configurado.

---

## 9. Fluxo típico de desenvolvimento

1. Editar `prisma/schema.prisma` para mudar o modelo.
2. `npx prisma migrate dev --name <mudanca>` — cria e aplica migration em dev.
3. `npx prisma generate` — regenera o tipo do client (automático no passo anterior).
4. Editar código em `src/` (rotas, componentes, libs).
5. `npm run dev` continua rodando e faz hot reload.
6. Antes de commitar: `npm run lint`.

Ao trocar de branch com migrations novas:
```bash
git pull
npm install                    # se package.json mudou
npx prisma migrate deploy      # aplica migrations novas
npx prisma generate            # regenera o client
```

---

## 10. Prisma Studio (explorar dados à mão)

```bash
npm run db:studio
```

Abre uma interface web (em http://localhost:5555) com todas as tabelas do Supabase. Útil para:
- Conferir o resultado do seed.
- Editar um `OrgMember.role` rapidamente sem escrever SQL.
- Investigar dados antes de implementar uma nova rota.

---

## 11. Troubleshooting

| Sintoma | Causa provável | Correção |
|---|---|---|
| `Can't reach database server` ao rodar migration | `DIRECT_URL` ausente ou errada | Confirma que colou a string da aba "Direct connection" do Supabase. |
| `prepared statement ... already exists` em runtime | Usando `DIRECT_URL` como `DATABASE_URL` (conexão não-pooled) | `DATABASE_URL` **tem** que ser a do pooler, porta 6543. |
| `P3009` / `migration already applied` | Estado inconsistente da tabela `_prisma_migrations` | Em dev: `npx prisma migrate reset`. Em produção: investigar antes de mexer. |
| `NEXTAUTH_SECRET missing` ao rodar dev | Variável ausente no `.env.local` | Gere e cole o secret conforme passo 4. |
| Login não funciona (`auth error`) | Seed não rodou | `npm run seed`. |
| `Module not found: '@prisma/client'` após trocar de branch | Client desatualizado | `npx prisma generate`. |
| Uploads de evidência somem em dev | Pasta `uploads/` apagada | Ela é criada on-demand; basta fazer upload de novo. |
| Gerador de IA volta casos genéricos ("Caso mock 1") | Nenhum provider configurado | Configure `ANTHROPIC_API_KEY` no `.env.local` **ou** vá em `/admin/ai` após logar como super admin. |

---

## 12. Configurando o provedor de IA (opcional, mas recomendado)

Duas opções, ambas funcionam:

### Opção A — Via painel (recomendado)

1. Faça login como `superadmin@testflow.com`.
2. Vá em **Painel Admin → Configuração IA** (`/admin/ai`).
3. Escolha o provedor (**OpenAI / Manus / Claude**), cole a API key e salve.

Isso grava em `Setting.value` com chave `ai_provider_config`. Persiste no banco — não precisa reiniciar.

### Opção B — Via env var

Coloque uma das três no `.env.local` e reinicie:
```env
ANTHROPIC_API_KEY=sk-ant-...     # prioridade 1
MANUS_API_KEY=...                # prioridade 2
OPENAI_API_KEY=sk-...            # prioridade 3
```

Sem nenhuma das duas opções, o gerador retorna **casos mock** — o fluxo não quebra, serve para desenvolvimento offline.

---

## 13. Opcional — configurando SMTP para convites reais

Os endpoints `POST /api/orgs/members` e `POST /api/admin/orgs` tentam mandar e-mail via Nodemailer. Em dev, **se não houver SMTP configurado**, o envio falha silenciosamente e o endpoint devolve a senha temporária no JSON de resposta — então você pode continuar sem e-mail, basta copiar a senha do devtools.

Para testar o fluxo de e-mail:
1. Ative "App passwords" na conta Google: https://myaccount.google.com/apppasswords
2. Preencha no `.env.local`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=seu@gmail.com
   SMTP_PASS=a-senha-de-app-gerada
   SMTP_FROM="TestFlow <seu@gmail.com>"
   ```
3. Reinicie o `npm run dev`.

---

## 14. Deploy em produção

Esse guia cobre apenas o setup local. Para produção (Vercel + Supabase, Railway, VPS), consulte o arquivo `DEPLOY.md` na raiz do repositório. Os passos principais:

1. Criar banco de produção no Supabase (região do usuário).
2. Configurar as variáveis na plataforma (Vercel / Railway / etc.).
3. Rodar `DEPLOY_ENV=production npx prisma migrate deploy` contra o banco de produção.
4. Configurar `NEXTAUTH_URL` para o domínio final.
5. Rodar o seed **uma única vez** em produção (só para criar o super admin inicial).
6. Substituir `uploads/` por um bucket (R2 / S3 / Supabase Storage) — no serverless o disco não persiste.

---

## 15. Checklist final

Antes de começar a mexer no código, confirme que:

- [ ] `node -v` retorna `20.x` ou superior
- [ ] `.env.local` tem `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- [ ] `npx prisma migrate deploy` terminou sem erro
- [ ] `npm run seed` criou o super admin e a Demo Org
- [ ] `npm run dev` subiu em `http://localhost:3000`
- [ ] Login com `superadmin@testflow.com` / `admin123` cai em `/admin`
- [ ] Login com `admin@testflow.com` / `admin123` cai no dashboard da Demo Org

Tudo pronto — abra `docs/03-estrutura.md` para entender quem faz o quê.
