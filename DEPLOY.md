# Guia de Deploy — TestFlow em Produção

## Visão Geral da Stack

| Componente | Local (atual) | Produção (necessário) |
|---|---|---|
| Framework | Next.js 16 | Mesmo |
| Banco de dados | SQLite (`dev.db`) | Turso, Supabase **ou** PostgreSQL |
| Arquivos (uploads) | Pasta `uploads/` | Armazenamento em nuvem |
| Auth | NextAuth JWT | Mesmo + secret forte |
| E-mail | SMTP configurado | SMTP (Gmail, Resend, etc.) |
| IA | Manus/OpenAI | Mesmo (via variáveis de ambiente) |

---

## Escolhendo a Plataforma

### Opção A — Vercel + Turso *(Recomendado para começar)*
- **Prós:** Deploy em minutos, SSL automático, CDN global, plano grátis generoso, integração nativa com Next.js
- **Contras:** Serverless — não pode usar disco local para uploads (precisa de bucket)
- **Custo:** Grátis para começar

### Opção A2 — Vercel + Supabase *(Alternativa popular ao Turso)*
- **Prós:** PostgreSQL completo, painel visual de dados, plano grátis com 500MB, fácil de usar
- **Contras:** Serverless igual ao Vercel puro — uploads precisam de bucket externo
- **Custo:** Grátis para começar

### Opção B — Railway *(Mais simples, mais controle)*
- **Prós:** Servidor persistente (pode manter SQLite e uploads locais no início), deploy via GitHub, PostgreSQL nativo
- **Contras:** Plano grátis limitado ($5/mês para uso contínuo)
- **Custo:** ~$5–20/mês

### Opção C — VPS Ubuntu *(Máximo controle)*
- **Prós:** Total liberdade, sem limites de serverless, mais barato em escala
- **Contras:** Você gerencia servidor, SSL, atualizações
- **Custo:** $4–10/mês (DigitalOcean, Hetzner, Contabo)

---

## Opção A — Vercel + Turso (Passo a Passo)

### 1. Preparar o banco de dados com Turso

O projeto já tem `@libsql/client` e `@prisma/adapter-libsql` instalados — Turso é plug-and-play.

```bash
# Instalar CLI do Turso
npm install -g @tursodatabase/turso

# Fazer login
turso auth login

# Criar o banco
turso db create testflow-prod

# Pegar a URL e criar token
turso db show testflow-prod --url
turso db tokens create testflow-prod
```

Você receberá dois valores — anote:
- `DATABASE_URL` → `libsql://testflow-prod-<user>.turso.io`
- `DATABASE_AUTH_TOKEN` → token gerado

**Atualizar o schema do Prisma** para usar libsql:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

> O provider continua `"sqlite"` — o adapter libsql interpreta automaticamente quando a URL começa com `libsql://`.

**Atualizar `src/lib/prisma.ts`** para usar o adapter:

```ts
import { PrismaClient } from "@/generated/prisma";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

function createPrisma() {
  if (process.env.DATABASE_AUTH_TOKEN) {
    // Produção: Turso remoto
    const libsql = createClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }
  // Local: SQLite arquivo
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Rodar as migrations no Turso:**

```bash
DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." npx prisma migrate deploy
```

---

### 2. Armazenamento de arquivos (uploads)

A pasta `uploads/` não persiste em ambiente serverless. Use **Cloudflare R2** (grátis até 10GB) ou **Vercel Blob**.

**Opção mais simples — Cloudflare R2:**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Variáveis de ambiente adicionais:
```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=testflow-uploads
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

> Alternativa imediata sem código: configure o R2 para aceitar os arquivos atuais e atualize as rotas de upload (`/api/uploads`).

---

### 3. Deploy na Vercel

```bash
# Instalar CLI
npm install -g vercel

# Dentro da pasta do projeto
vercel

# Seguir os prompts:
# - Link to existing project? No
# - Project name: testflow
# - Root directory: ./
# - Override settings? No
```

Ou conecte via **GitHub** em [vercel.com](https://vercel.com) → New Project → Import Repository.

**Configurar variáveis de ambiente na Vercel:**

Vá em **Project → Settings → Environment Variables** e adicione:

```env
DATABASE_URL=libsql://testflow-prod-<user>.turso.io
DATABASE_AUTH_TOKEN=<token-do-turso>

NEXTAUTH_SECRET=<string-aleatória-longa>
NEXTAUTH_URL=https://seu-dominio.vercel.app

# E-mail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
SMTP_FROM=TestFlow <noreply@seudominio.com>

# IA
MANUS_API_KEY=...
MANUS_BASE_URL=https://api.manus.ai
```

> Para gerar um `NEXTAUTH_SECRET` seguro:
> ```bash
> openssl rand -base64 32
> ```

**Deploy final:**
```bash
vercel --prod
```

---

## Opção A2 — Vercel + Supabase (Passo a Passo)

> Não sabe programar? Sem problema. Siga cada passo na ordem e não pule nenhum.

---

### Passo 1 — Criar conta no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Clique em **"Start your project"**
3. Faça login com sua conta do **GitHub** (recomendado) ou crie uma conta com e-mail
4. Após o login você será direcionado ao painel principal

---

### Passo 2 — Criar o projeto no Supabase

1. Clique em **"New project"**
2. Selecione sua organização (aparece com seu nome de usuário)
3. Preencha os campos:
   - **Name:** `testflow`
   - **Database Password:** crie uma senha forte e **anote ela agora** — você vai precisar depois
   - **Region:** `South America (São Paulo)` se seus usuários são do Brasil
4. Clique em **"Create new project"**
5. Aguarde ~2 minutos enquanto o banco é criado (vai aparecer uma barra de progresso)

---

### Passo 3 — Copiar as connection strings

Essas strings são o "endereço" do seu banco de dados na nuvem. Você vai precisar de **duas**.

1. Com o projeto aberto no Supabase, clique no botão **"Connect"** no topo da tela (botão verde)
2. Um modal abrirá — no topo há 4 abas: `Framework` | `Direct` | `ORM` | `MCP`
3. Clique na aba **"Direct"**
4. Em **"Connection Method"**, selecione **"Transaction pooler"**
5. Confirme que aparece **"IPv4 compatible"** com um check verde
6. Clique no ícone de copiar ao lado da string
7. Abra o **Bloco de Notas** no seu computador e cole assim:
```
DATABASE_URL=postgresql://postgres.vxwzykgaaflxpxngzxhy:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres
```
8. Ainda no mesmo modal, selecione **"Direct connection"** em Connection Method
9. Copie a nova string que aparecer
10. No Bloco de Notas, cole em uma nova linha assim:
```
DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.vxwzykgaaflxpxngzxhy.supabase.co:5432/postgres
```

Deixe o Bloco de Notas aberto.

> **Por que duas strings?**
> - `DATABASE_URL` (Transaction pooler): usada pela aplicação em produção
> - `DIRECT_URL` (Direct connection): usada para criar as tabelas no banco

---

### Passo 4 — Abrir o projeto no VS Code

1. Abra o **VS Code**
2. Vá em **File → Open Folder**
3. Navegue até `c:\Users\wesml\testflow` e clique em **"Selecionar Pasta"**

---

### Passo 5 — Alterar o arquivo `prisma/schema.prisma`

1. No painel esquerdo do VS Code, clique na pasta **`prisma`**
2. Clique no arquivo **`schema.prisma`**
3. No começo do arquivo, encontre este trecho:
```prisma
datasource db {
  provider = "sqlite"
}
```
4. **Apague esse trecho** e substitua por:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
5. Salve com **Ctrl + S**

---

### Passo 6 — Instalar o driver do PostgreSQL

1. No VS Code, abra o terminal indo em **Terminal → New Terminal** (ou **Ctrl + `**)
2. Digite o comando abaixo e pressione **Enter**:
```bash
npm install @prisma/adapter-pg pg
```
3. Aguarde a instalação terminar

---

### Passo 7 — Criar o arquivo `.env.production`

Esse arquivo guarda todas as senhas e configurações do sistema em produção. **Ele nunca vai para o GitHub.**

1. No VS Code, clique com o botão direito na pasta raiz **`testflow`** no painel esquerdo
2. Clique em **"New File"**
3. Nomeie como `.env.production` e pressione **Enter**
4. Cole o conteúdo abaixo, substituindo os valores pelos seus:

```env
DATABASE_URL=cole-aqui-a-string-do-transaction-pooler
DIRECT_URL=cole-aqui-a-string-do-direct-connection

NEXTAUTH_SECRET=cole-aqui-o-resultado-do-comando-abaixo
NEXTAUTH_URL=https://seu-app.vercel.app

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app-gmail
SMTP_FROM=TestFlow <noreply@gmail.com>

MANUS_API_KEY=sua-chave-manus
MANUS_BASE_URL=https://api.manus.ai
```

5. Para gerar o `NEXTAUTH_SECRET`, no terminal do VS Code rode:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
6. Copie o resultado e cole no lugar de `cole-aqui-o-resultado-do-comando-abaixo`
7. Salve com **Ctrl + S**

> O `NEXTAUTH_URL` será atualizado depois que você tiver a URL da Vercel.

---

### Passo 8 — Criar as tabelas no banco do Supabase

1. No terminal do VS Code rode:
```bash
npx prisma migrate deploy
```
2. Aguarde terminar — vai aparecer `All migrations have been successfully applied`
3. Depois rode o seed para criar o usuário administrador:
```bash
npm run seed
```
4. **Anote o e-mail e senha** que aparecerem no terminal — são as credenciais do super admin

---

### Passo 9 — Criar conta na Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"Sign Up"**
3. Escolha **"Continue with GitHub"**
4. Autorize o acesso quando solicitado

---

### Passo 10 — Fazer o deploy na Vercel

1. No painel da Vercel, clique em **"Add New Project"**
2. Clique em **"Import Git Repository"**
3. Encontre o repositório `testflow` e clique em **"Import"**
4. Antes de clicar em Deploy, procure a seção **"Environment Variables"**
5. Adicione cada variável do seu `.env.production` — **uma por vez**:
   - No campo **Key** coloque o nome (ex: `DATABASE_URL`)
   - No campo **Value** cole o valor
   - Clique em **"Add"**
   - Repita para todas as variáveis
6. Após adicionar todas, clique em **"Deploy"**
7. Aguarde 2–3 minutos

Ao terminar, a Vercel vai te dar uma URL como `https://testflow-abc123.vercel.app`.

---

### Passo 11 — Atualizar o NEXTAUTH_URL

Agora que você tem a URL final:

1. Vá em **Vercel → seu projeto → Settings → Environment Variables**
2. Encontre `NEXTAUTH_URL` e clique em editar
3. Substitua `https://seu-app.vercel.app` pela URL real que a Vercel gerou
4. Salve e vá em **Deployments → clique nos 3 pontos do último deploy → Redeploy**

---

### Passo 12 — Verificar se funcionou

1. Acesse a URL gerada pela Vercel
2. Faça login com as credenciais do super admin geradas no Passo 8
3. Se der erro, vá em **Vercel → Project → Deployments → clique no deploy → View logs**

---

### Vantagens do Supabase além do banco

O Supabase oferece recursos extras que podem ser úteis futuramente:

| Recurso | O que faz |
|---|---|
| **Storage** | Bucket de arquivos para substituir a pasta `uploads/` |
| **Table Editor** | Interface visual para ver e editar dados do banco |
| **SQL Editor** | Rodar queries direto no painel |
| **Logs** | Ver queries lentas e erros em tempo real |

Para usar o **Supabase Storage** no lugar da pasta `uploads/`:
```bash
npm install @supabase/supabase-js
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<chave-service-role>
```

---

## Opção B — Railway (Passo a Passo)

### 1. Criar conta e projeto

- Acesse [railway.app](https://railway.app) → New Project → Deploy from GitHub
- Conecte seu repositório

### 2. Adicionar PostgreSQL

No painel do Railway: **New Service → Database → PostgreSQL**

Copie a `DATABASE_URL` gerada (formato `postgresql://...`).

**Atualizar o schema do Prisma** para PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

> Nota: SQLite e PostgreSQL têm pequenas diferenças de tipos. Campos `String` em JSON (como `roleNames`, `tags`, `metadata`) funcionam igual. Os tipos básicos são compatíveis, o Prisma cuida da diferença.

Rodar migrations:
```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### 3. Variáveis de ambiente no Railway

No painel do projeto → **Variables**:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}   # Railway injeta automaticamente
NEXTAUTH_SECRET=<string-forte>
NEXTAUTH_URL=https://<seu-app>.railway.app
NODE_ENV=production

SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
# etc.
```

### 4. Configurar o build

O Railway detecta Next.js automaticamente. Se precisar, adicione um `Procfile` na raiz:

```
web: npm run build && npm start
```

---

## Opção C — VPS Ubuntu (Passo a Passo)

### 1. Servidor (mínimo recomendado: 1 vCPU, 1GB RAM)

Fornecedores recomendados:
- **Hetzner** (melhor custo-benefício, Europa) — €4/mês
- **Contabo** — €5/mês
- **DigitalOcean** — $6/mês

### 2. Configuração inicial do servidor

```bash
# Conectar via SSH
ssh root@<ip-do-servidor>

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PM2 (gerenciador de processos)
npm install -g pm2

# Instalar Nginx
apt install -y nginx

# Instalar Git
apt install -y git
```

### 3. Deploy da aplicação

```bash
# Criar usuário de deploy
adduser deploy
usermod -aG sudo deploy
su - deploy

# Clonar o repositório
git clone https://github.com/<seu-user>/testflow.git /home/deploy/testflow
cd /home/deploy/testflow

# Instalar dependências
npm install

# Criar arquivo .env.production
nano .env.production
```

Conteúdo do `.env.production`:
```env
NODE_ENV=production
DATABASE_URL=file:/home/deploy/testflow/data/prod.db
NEXTAUTH_SECRET=<string-forte>
NEXTAUTH_URL=https://seudominio.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=TestFlow <noreply@seudominio.com>

MANUS_API_KEY=...
```

```bash
# Criar pasta para dados persistentes
mkdir -p /home/deploy/testflow/data

# Rodar migrations
npx prisma migrate deploy

# Seed inicial (cria super admin)
npm run seed

# Build de produção
npm run build

# Iniciar com PM2
pm2 start npm --name "testflow" -- start
pm2 save
pm2 startup  # seguir as instruções exibidas
```

### 4. Configurar Nginx como reverse proxy

```bash
nano /etc/nginx/sites-available/testflow
```

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /home/deploy/testflow/uploads/;
        expires 30d;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/testflow /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 5. SSL com Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d seudominio.com -d www.seudominio.com
```

### 6. Atualizações futuras

```bash
cd /home/deploy/testflow
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart testflow
```

---

## Variáveis de Ambiente — Referência Completa

```env
# ── Obrigatórias ──────────────────────────────────────────
NODE_ENV=production

# Banco de dados
DATABASE_URL=...                    # libsql://, postgresql://, ou file:///...
DATABASE_AUTH_TOKEN=...             # Apenas para Turso

# Autenticação
NEXTAUTH_SECRET=...                 # openssl rand -base64 32
NEXTAUTH_URL=https://seudominio.com # URL pública da aplicação

# ── E-mail (para envio de convites/credenciais) ───────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=senha-de-app-gmail       # Não a senha normal — gerar em conta Google
SMTP_FROM=TestFlow <noreply@seudominio.com>

# ── IA ────────────────────────────────────────────────────
MANUS_API_KEY=...
MANUS_BASE_URL=https://api.manus.ai
# ou
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

---

## Checklist Pré-Deploy

- [ ] `NEXTAUTH_SECRET` com valor forte e único (nunca use o valor de desenvolvimento)
- [ ] `NEXTAUTH_URL` aponta para o domínio real com HTTPS
- [ ] Banco de dados de produção configurado (não o `dev.db`)
- [ ] Migrations rodadas no banco de produção
- [ ] Seed rodado para criar o super admin inicial
- [ ] SMTP testado (envio de e-mail funciona)
- [ ] Chaves de IA configuradas
- [ ] Uploads persistentes configurados (se usar Vercel/serverless)
- [ ] Arquivo `.env.local` **não** está no repositório (verifique o `.gitignore`)

---

## Recomendação Final

| Situação | Plataforma |
|---|---|
| Quer subir rápido, SQLite, sem configuração | **Vercel + Turso** |
| Quer PostgreSQL completo com painel visual de dados | **Vercel + Supabase** |
| Quer simplicidade e custo fixo baixo | **Railway** |
| Vai ter muitos usuários ou precisa de controle total | **VPS (Hetzner + Nginx)** |

**Vercel + Supabase** é atualmente a combinação mais popular para projetos Next.js em produção — PostgreSQL robusto, painel visual para gerenciar dados, plano gratuito generoso, e o Supabase Storage pode substituir a pasta `uploads/` sem precisar de outro serviço.
