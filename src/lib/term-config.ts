/**
 * Customizable UI terms — stored in localStorage.
 * Each entry has a singular and plural form.
 */

export type TermEntry = { singular: string; plural: string };

export interface Terms {
  // Alta prioridade — entidades principais
  projeto:      TermEntry;
  item:         TermEntry;
  casoDeTeste:  TermEntry;
  planoDeTeste: TermEntry;
  execucao:     TermEntry;
  relatorio:    TermEntry;
  // Média prioridade — rótulos de campo
  ambiente:     TermEntry;
  build:        TermEntry;
  evidencia:    TermEntry;
  bugRelacionado: TermEntry;
  preCondicao:  TermEntry;
}

export const DEFAULT_TERMS: Terms = {
  projeto:       { singular: "Projeto",        plural: "Projetos" },
  item:          { singular: "Item",           plural: "Itens" },
  casoDeTeste:   { singular: "Caso de Teste",  plural: "Casos de Teste" },
  planoDeTeste:  { singular: "Plano de Teste", plural: "Planos de Teste" },
  execucao:      { singular: "Execução",       plural: "Execuções" },
  relatorio:     { singular: "Relatório",      plural: "Relatórios" },
  ambiente:      { singular: "Ambiente",       plural: "Ambientes" },
  build:         { singular: "Build / Versão", plural: "Builds / Versões" },
  evidencia:     { singular: "Evidência",      plural: "Evidências" },
  bugRelacionado:{ singular: "Bug Relacionado",plural: "Bugs Relacionados" },
  preCondicao:   { singular: "Pré-condição",   plural: "Pré-condições" },
};

export const DEFAULT_TERMS_EN: Terms = {
  projeto:       { singular: "Project",      plural: "Projects" },
  item:          { singular: "Item",         plural: "Items" },
  casoDeTeste:   { singular: "Test Case",    plural: "Test Cases" },
  planoDeTeste:  { singular: "Test Plan",    plural: "Test Plans" },
  execucao:      { singular: "Execution",    plural: "Executions" },
  relatorio:     { singular: "Report",       plural: "Reports" },
  ambiente:      { singular: "Environment",  plural: "Environments" },
  build:         { singular: "Build / Version", plural: "Builds / Versions" },
  evidencia:     { singular: "Evidence",     plural: "Evidence" },
  bugRelacionado:{ singular: "Related Bug",  plural: "Related Bugs" },
  preCondicao:   { singular: "Precondition", plural: "Preconditions" },
};

function storageKey(lang?: string): string {
  const l = lang ?? (typeof window !== "undefined" ? (localStorage.getItem("testflow_lang") ?? "pt-BR") : "pt-BR");
  return l === "en-US" ? "testflow_terms_en-US" : "testflow_terms";
}

function defaultsForLang(lang?: string): Terms {
  const l = lang ?? (typeof window !== "undefined" ? (localStorage.getItem("testflow_lang") ?? "pt-BR") : "pt-BR");
  return l === "en-US" ? DEFAULT_TERMS_EN : DEFAULT_TERMS;
}

export function getTerms(lang?: string): Terms {
  if (typeof window === "undefined") return defaultsForLang(lang);
  const defaults = defaultsForLang(lang);
  try {
    const raw = localStorage.getItem(storageKey(lang));
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveTerms(v: Terms, lang?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(lang), JSON.stringify(v));
}

export function resetTerms(lang?: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(lang));
}
