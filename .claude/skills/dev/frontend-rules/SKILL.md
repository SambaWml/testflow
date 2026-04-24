---
name: frontend-rules
description: Regras e boas práticas para código frontend do TestFlow (Next.js 16 App Router + React 19 + TanStack Query v5 + Zustand + RHF/Zod + Radix/shadcn + Tailwind 4). Use ao criar/editar páginas, componentes, hooks, forms, contextos e tudo em `src/app/(dashboard|auth)/` e `src/components/`.
---

# Frontend Rules — TestFlow

Stack fixa: **Next.js 16 (App Router) + React 19 + TS estrito + TanStack Query v5 + Zustand + React Hook Form + Zod + Radix/shadcn + Tailwind 4**. Não introduza libs concorrentes.

## Princípios de código

- **DRY** — se o mesmo bloco aparece em 3 lugares, extraia. 2 ainda é cedo: extração prematura custa mais que duplicação.
- **YAGNI** — não crie "helper genérico para o futuro", prop opcional sem caller, flag de feature sem ramo real. Escreva para o caso que existe hoje.
- **KISS** — prefira código linear e explícito a abstrações elegantes. Se um `if` resolve, não faça factory/strategy.
- **Boundaries antes de abstração** — separe por responsabilidade (UI / dados / regra), não por "camada bonita".
- **Nomear > comentar** — renomeie variáveis/funções até o comentário ficar redundante. Só comente o *porquê* quando não for óbvio.

## Organização de pastas

Estrutura canônica dentro de `src/`:

```
src/
├─ app/                    # rotas App Router (páginas, layouts, routes de API)
├─ components/
│  ├─ ui/                  # primitivos Radix/shadcn — NÃO modificar sem motivo forte
│  ├─ layout/              # topbar, sidebar, shells de página
│  └─ <feature>/           # componentes de uma feature (ex: cases/, projects/)
├─ hooks/                  # hooks reutilizáveis (use-debounce, use-pagination, etc.)
├─ services/               # wrappers de fetch/API client por recurso (cases.service.ts)
├─ types/                  # tipos compartilhados (domain types, DTOs, enums)
├─ lib/                    # utilitários singleton (prisma, auth, i18n, utils)
└─ contexts/               # Providers de contexto (lang, terms, theme)
```

Regras:

- Um componente específico de uma feature mora em `components/<feature>/`. Só promova para `components/ui/` quando for genuinamente genérico e usado em 2+ features distintas.
- Hooks com estado/side-effect reutilizáveis vão em `src/hooks/`. Hook usado só por um componente fica **co-localizado** no mesmo arquivo/pasta — não force `hooks/`.
- Chamadas HTTP ficam em `src/services/<recurso>.service.ts`. Componentes chamam o service, nunca `fetch` direto.
- Types compartilhados em `src/types/`. Types de um único componente ficam no próprio arquivo.
- Nada de `utils/` genérico virando lixão: `src/lib/utils.ts` já existe — agrupe por domínio, não por "tipo de coisa".

Nomenclatura: arquivos em **kebab-case** (`case-edit-dialog.tsx`), componentes em **PascalCase**, hooks começam com `use`, services sufixo `.service.ts`.

## Gerenciamento de estado (simples, por escopo)

| Tipo de estado | Ferramenta |
|---|---|
| Estado de servidor (dados da API) | **TanStack Query** — `useQuery`, `useMutation`, `useInfiniteQuery` |
| Estado local de componente | `useState` / `useReducer` |
| Estado compartilhado cliente-cliente (modais globais, sidebar, filtros persistentes) | **Zustand** (um store por domínio, não um mega-store) |
| Estado de URL (filtros, paginação, tabs) | `useSearchParams` + `router.replace` — serve como source of truth, compartilhável via link |
| Form | **React Hook Form + zodResolver** |
| Tema / idioma / termos | Contexts já existentes em `src/contexts/` |

Regras de decisão:

1. **Se vem da API → TanStack Query.** Não duplique em Zustand nem em `useState`.
2. **Se cabe em `useState` local, fique com `useState`.** Zustand só quando 2+ componentes distantes compartilham.
3. **Evite Context para dados que mudam muito** — re-renderiza toda a árvore. Use Zustand com seletor.
4. **TanStack Query v5 removeu `onSuccess`/`onError` de `useQuery`.** Use `useEffect` observando `data`/`error`, ou `useMutation` (que ainda tem callbacks).

## Data fetching padrão

```ts
// src/services/cases.service.ts
export async function listCases(projectId: string): Promise<Case[]> {
  const res = await fetch(`/api/projects/${projectId}/cases`);
  if (!res.ok) throw new Error("Failed to fetch cases");
  return res.json();
}

// No componente
const { data, isLoading } = useQuery({
  queryKey: ["cases", projectId],
  queryFn: () => listCases(projectId),
  enabled: !!projectId,
});
```

- `queryKey` sempre começa com o nome do recurso e inclui todos os parâmetros que afetam o resultado.
- Para tabs, carregue sob demanda: `enabled: activeTab === "bugs"`.
- Invalide caches relacionados após mutations: `queryClient.invalidateQueries({ queryKey: ["cases"] })`.

## Forms

```ts
const schema = z.object({ title: z.string().min(1), priority: z.enum(["LOW","MEDIUM","HIGH"]) });
type FormData = z.infer<typeof schema>;

const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: {...} });
```

- Um schema Zod por form. Reutilize schemas do backend quando possível (coloque em `src/types/`).
- Use componentes `Form*` do shadcn — eles já integram com RHF.

## Server Components vs Client Components

- **Default é Server Component** — não adicione `"use client"` por reflexo.
- Client Component quando: usa hook, event handler, `useEffect`, state, Context, ou lib que depende de browser.
- `params` em páginas é **`Promise`** (Next 15+). Em Server Component: `await params`. Em Client: `use(params)` do React 19.
- Fetch inicial em Server Component quando puder — evita flash de loading.

## i18n e termos customizáveis

- **Nunca hardcode texto de entidade.** Use `useTerms()` para "projeto", "caso", "bug", "execução", etc.
- Use `useLang()` para idioma, locale de datas (`date-fns`), e textos de UI.
- Strings vão em `src/lib/i18n.ts` — não espalhe strings pelo JSX.

## Acessibilidade e UX

- Use os primitivos Radix (`src/components/ui/`) — eles já tratam keyboard nav e ARIA.
- Toda ação destrutiva pede confirmação (AlertDialog).
- Loading: `isLoading` → Skeleton. Erro: toast + estado visível. Vazio: empty state com ação próxima.
- Form nunca envia duas vezes: `disabled={isSubmitting || !form.formState.isValid}`.

## Performance sem complicar

- Liste a causa antes de otimizar. Não decore tudo com `useMemo`/`useCallback` — só quando o profiler aponta ou quando a referência é dep de outro hook.
- Imagens: `next/image`.
- Rota pesada: dynamic import (`next/dynamic`) com `ssr: false` quando for só-client.

## Checklist antes de abrir PR

- [ ] Nenhum `findUnique` via client em rota multi-tenant (isso é backend, mas se componente chama rota nova, confirme).
- [ ] Nenhum texto de entidade hardcoded — passou por `useTerms()`.
- [ ] Sem `any` — se precisar escapar, use `unknown` + narrowing.
- [ ] `queryKey` única e estável; mutations invalidam o que precisa.
- [ ] Rodou `npm run lint` limpo.
- [ ] Testou fluxo no navegador (golden path + um edge case).
