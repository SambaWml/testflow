# Docs — TestFlow

Documentação de onboarding para quem está começando no projeto. Leia nesta ordem:

1. **[01-arquitetura.md](./01-arquitetura.md)** — O que é o TestFlow, stack completa com versões, estrutura de pastas, decisões arquiteturais, modelo de dados.
2. **[02-setup.md](./02-setup.md)** — Manual passo-a-passo para rodar localmente: criar banco no Supabase, instalar dependências, aplicar migrations com Prisma, seed, subir o dev server. Inclui troubleshooting.
3. **[03-estrutura.md](./03-estrutura.md)** — Quem faz o quê: papel do Next.js, do React, da estilização (Tailwind + Radix), onde fica o backend, como cliente/servidor se comunicam, por que Prisma como ORM e como trabalhar com ele.
4. **[04-features.md](./04-features.md)** — Features detalhadas, roles e permissões, workflow completo de criação de workspace e onboarding de usuários, matriz de "quem pode o quê".

Complementares (já existiam na raiz do repo):
- **`../AGENTS.md`** — Padrões obrigatórios (checagens de IDOR, status HTTP, convenções do Prisma).
- **`../CLAUDE.md`** — Notas para agentes IA (arquitetura resumida para contexto).
- **`../README.md`** — Overview curto + rotas.
- **`../DEPLOY.md`** — Guias de deploy em Vercel, Supabase, Railway, VPS.
