---
name: generate-playwright
description: Gera specs Playwright E2E para o TestFlow seguindo as convenções do projeto (tests/e2e/, auth salvo em tests/.auth/, page.request em vez do fixture request, cross-org em beforeAll). Use quando o usuário pedir "teste E2E", "spec Playwright", "automatizar caso X" ou depois de gerar um plano de testes.
---

# Generate Playwright Specs

Gera specs **Playwright** E2E para TestFlow. Sempre em TypeScript, sempre seguindo a convenção do repo.

## Pré-checagens

1. **Estrutura de testes existe?**
   - Verifique `tests/e2e/`, `playwright.config.ts`, `tests/global.setup.ts`, `tests/.auth/*.json`.
   - Se não existir, **pergunte ao usuário antes de criar scaffolding** — é decisão de projeto (adicionar dependência, config, CI). Não invente.
2. **Há plano de testes?** Se o usuário veio da skill `generate-test-plan`, use os casos ali. Senão, peça o caso/fluxo alvo — ou gere o plano primeiro.
3. **Alvo é UI ou API?** Playwright cobre ambos — decide o estilo do spec.

## Convenções obrigatórias

Vindo de `AGENTS.md`:

- Specs ficam em **`tests/e2e/`**, um arquivo por fluxo/feature.
- Autenticação **pré-salva** em `tests/.auth/*.json` (gerada por `global.setup.ts`, ignorada no git). Não logue via UI em cada spec — use `storageState`.
- Use **`page.request`** (compartilha cookie da sessão) em vez do fixture `request` (sem cookie).
- Cross-org em `beforeAll`:
  ```ts
  const adminCtx = await browser.newContext({ storageState: "tests/.auth/admin.json" });
  ```
- CI está **pausado por padrão** (`workflow_dispatch`). Não reative sem pedido explícito.

## Estrutura do spec

```ts
import { test, expect } from "@playwright/test";

test.describe("<Feature> — <papel>", () => {
  test.use({ storageState: "tests/.auth/<papel>.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/<rota>");
  });

  test("CT-001 — <título do caso de teste>", async ({ page }) => {
    // Arrange
    // Act
    await page.getByRole("button", { name: "Criar" }).click();
    // Assert
    await expect(page.getByText(/sucesso/i)).toBeVisible();
  });

  test("CT-002 — usuário de outra org recebe 404", async ({ page }) => {
    const res = await page.request.get(`/api/projects/${crossOrgProjectId}`);
    expect(res.status()).toBe(404);
  });
});
```

## Regras de estilo

### Selectors — prioridade

1. `getByRole` com nome acessível — **preferido**.
2. `getByLabel` / `getByPlaceholder` — para inputs.
3. `getByTestId` — para coisas sem semântica clara (adicione `data-testid` no componente se necessário; use sparingly).
4. **Evite** CSS selectors, XPath, e `.nth(n)`. Evite texto frágil que muda com i18n — se precisar casar texto, use regex e cobra ambos idiomas se a app é bilíngue.

### Asserts — sempre com `expect` auto-retry

```ts
// BOM — auto-retry até timeout
await expect(page.getByRole("row", { name: /novo caso/i })).toBeVisible();

// RUIM — snapshot instantâneo, flaky
expect(await page.getByRole("row").count()).toBe(3);
```

### Esperas

- **Nunca** `page.waitForTimeout(n)`. É flake garantido.
- Use `await expect(locator).toBeVisible()` ou `await page.waitForURL(/pattern/)`.
- Para requests: `page.waitForResponse(resp => resp.url().includes("/api/..."))`.

### Dados

- Crie dados de teste **via API** (`page.request.post`) no `beforeEach`/`beforeAll`, não via UI. UI só quando o caso testa UI.
- Limpe em `afterEach`/`afterAll` via API. Se o teste falhar no meio, deixe o cleanup robusto (use `.catch(() => {})` para não mascarar a falha real do teste).
- IDs gerados (CUID) — guarde em variável, não tente prever.

### Multi-tenant — o padrão crítico

Todo spec que testa endpoint/rota com `[id]` **deve ter um caso negativo cross-org**:

```ts
test("retorna 404 ao acessar projeto de outra org", async ({ browser }) => {
  const otherOrgCtx = await browser.newContext({ storageState: "tests/.auth/org-b-admin.json" });
  const otherPage = await otherOrgCtx.newPage();
  const res = await otherPage.request.get(`/api/projects/${orgAProjectId}`);
  expect(res.status()).toBe(404);
  await otherOrgCtx.close();
});
```

### Papéis

Um arquivo de storageState por papel: `admin.json`, `member.json`, `viewer.json`, `super-admin.json`. Rode o mesmo caso com papéis diferentes via `test.describe` separados ou data-driven:

```ts
for (const role of ["owner", "admin", "member"] as const) {
  test.describe(`como ${role}`, () => {
    test.use({ storageState: `tests/.auth/${role}.json` });
    test("...", async ({ page }) => { /* ... */ });
  });
}
```

## Mapeamento: plano → spec

| Caso do plano | Vira Playwright? |
|---|---|
| CT funcional com assertiva visual/UI | ✅ Sim |
| CT de autorização (401/403/404) | ✅ Sim — prefira `page.request` |
| CT de validação com mensagem específica | ✅ Sim |
| CT de regra de negócio pura (sem UI) | ⚠️ Teste de unidade/integração seria melhor — confirme com usuário |
| CT de borda envolvendo race condition | ⚠️ Difícil em E2E; documente como limitação |

## Fluxo de geração

1. Leia o plano (arquivo em `docs/test-plans/` se houver) ou a lista de casos que o usuário passou.
2. Leia o componente/rota alvo para extrair selectors reais (roles, labels, placeholders) — **não invente**.
3. Gere um arquivo `tests/e2e/<slug>.spec.ts` com `describe` por papel/cenário e `test` por caso do plano.
4. Se algum caso precisa de setup especial (seed, feature flag), adicione no `beforeAll` do próprio arquivo, não global.
5. Reporte ao usuário:
   - Caminho do arquivo criado.
   - Comando para rodar: `npx playwright test tests/e2e/<slug>.spec.ts`.
   - Casos do plano que **não** viraram spec e por quê.
   - Se algum `data-testid` precisa ser adicionado no componente.

## Não faça

- ❌ `page.waitForTimeout(...)`.
- ❌ Login via UI em cada teste — use `storageState`.
- ❌ Selectors acoplados a CSS/DOM instável.
- ❌ `expect(await x.count()).toBe(n)` — use asserção com auto-retry.
- ❌ Rodar contra banco de produção. Confirme `DATABASE_URL` antes se em dúvida.
- ❌ Ativar CI do Playwright sem pedido explícito (está pausado de propósito).
- ❌ Reinventar login/logout se `global.setup.ts` já prepara os storageStates.

## Entrega

Ao final, imprima no chat:
- Arquivo(s) criado(s).
- Comando de execução.
- Qualquer `data-testid` que adicionou no código da app (lista arquivo:linha).
- Casos pulados + motivo.
