---
name: generate-test-plan
description: Gera um plano de testes estruturado (manual/funcional) para uma feature, rota, fluxo ou história do TestFlow. Use quando o usuário pedir "plano de testes", "test plan", "casos de teste" ou quiser mapear o que precisa ser coberto antes de escrever automação.
---

# Generate Test Plan

Gera um plano de testes em **Markdown** estruturado, pronto para revisão e para servir de base à automação (Playwright, testes manuais, ou `TestCase` dentro do próprio TestFlow).

## Entrada esperada

Peça ao usuário (só o que não for óbvio do contexto):

1. **Alvo do plano** — rota/página/feature/endpoint (ex: `/api/projects`, página `/cases/[id]`, fluxo "criar organização").
2. **Contexto funcional** — o que essa feature faz, quem usa (papel: OWNER/ADMIN/MEMBER/SuperAdmin), o que é sucesso.
3. **Escopo** — só a feature ou fluxos adjacentes também (ex: login + criar projeto + convidar membro).
4. **Fora de escopo** — o que explicitamente não testar agora.

Se o alvo já é claro no contexto da conversa, não pergunte — vá direto.

## Passos

1. **Leia o código alvo** antes de escrever qualquer caso. Nunca invente endpoints, campos ou regras. Consulte:
   - Rota de API em `src/app/api/<recurso>/...`.
   - Página em `src/app/(dashboard)/<rota>/page.tsx` + componentes em `src/components/<feature>/`.
   - Schema em `prisma/schema.prisma` para campos obrigatórios/opcionais e enums.
   - Validação Zod se existir — é a fonte dos casos negativos.
   - `AGENTS.md` e `CLAUDE.md` para regras (multi-tenant, status codes, papéis).
2. **Identifique papéis envolvidos** e teste cada um separadamente quando relevante.
3. **Cubra as 4 dimensões**:
   - **Funcional** (happy path e variações válidas)
   - **Negativo** (validação, campo faltando, valor inválido)
   - **Autorização** (401, 403, 404 cross-org)
   - **Borda** (vazio, limite de tamanho, concorrência, estado inconsistente)
4. **Gere o plano** no formato abaixo.
5. **Salve** em `docs/test-plans/<YYYY-MM-DD>-<slug-da-feature>.md` (crie a pasta se não existir) — a menos que o usuário peça só para imprimir no chat.

## Formato do plano

````markdown
# Plano de Testes — <Nome da feature>

**Alvo:** `<rota/endpoint/feature>`
**Data:** <YYYY-MM-DD>
**Autor:** Claude (gerado)
**Status:** Rascunho

## Contexto

<1-3 linhas: o que a feature faz, quem usa, qual o objetivo de negócio.>

## Pré-condições

- Usuário autenticado com papel `<X>`.
- Organização `<Y>` com pelo menos `<Z>`.
- Feature flag `<flag>` habilitada (se aplicável).
- Dados seed: `<...>`.

## Escopo

**Dentro:** <lista>
**Fora:** <lista>

## Papéis testados

- OWNER / ADMIN / MEMBER / VIEWER / SuperAdmin / Não autenticado

## Casos de teste

### CT-001 — <Título curto e imperativo>

- **Prioridade:** Alta / Média / Baixa
- **Tipo:** Funcional / Negativo / Autorização / Borda
- **Papel:** <X>
- **Pré-condições:** <específicas deste caso>
- **Passos:**
  1. <Ação>
  2. <Ação>
  3. <Ação>
- **Resultado esperado:**
  - <Assertiva 1 — ex: status 201, body contém id>
  - <Assertiva 2 — ex: registro no banco com organizationId correto>
  - <Assertiva 3 — ex: UI exibe toast de sucesso>
- **Dados de teste:** `<JSON ou descrição>`

### CT-002 — ...

## Matriz de cobertura

| Requisito | Casos |
|---|---|
| Criar recurso válido | CT-001, CT-002 |
| Validação de campo obrigatório | CT-003 |
| Isolamento multi-tenant | CT-010, CT-011 |
| Autorização por papel | CT-007, CT-008, CT-009 |

## Riscos e observações

- <Área cinza que precisa de decisão humana>
- <Dependência externa>
- <Regra ambígua no código — linkar arquivo:linha>
````

## Heurísticas de cobertura mínima (TestFlow)

Para qualquer endpoint/feature multi-tenant, **todo plano inclui**:

- Acesso sem sessão → **401**.
- Acesso com sessão mas sem papel suficiente (MEMBER tentando ação de OWNER) → **403**.
- Acesso a recurso de outra org → **404** (nunca 403; ver `AGENTS.md`).
- Body inválido (campo faltando, tipo errado) → **400** com issues do Zod.
- Conflito de regra (ex: deletar projeto com itens) → **409**.
- Criação feliz → **201** com id/recurso.
- Listagem respeitando escopo de projeto (MEMBER vê só projetos em que está).

Para páginas (UI):

- Loading state visível.
- Empty state com ação.
- Erro com toast + recuperação.
- Form: campos obrigatórios, submit desabilita, validação inline.
- Confirmação em ação destrutiva (AlertDialog).
- i18n: nenhum texto hardcoded — passa por `useTerms()`/`useLang()`.

## Não faça

- ❌ Inventar endpoints ou campos que não existem no código.
- ❌ Casos genéricos que não disparariam bug real ("verificar se o sistema funciona").
- ❌ Misturar "configurar ambiente" com passos do caso — isso vai em pré-condições.
- ❌ Um único mega-caso cobrindo 10 assertivas — quebre por cenário.

## Entrega

Ao finalizar:
- Confirme o caminho do arquivo salvo.
- Aponte **qual caso é bom candidato a automação em Playwright** (use a skill `generate-playwright` em seguida se o usuário quiser).
- Liste questões em aberto (regras ambíguas) como bullets numerados para o usuário decidir.
