/**
 * Customizable UI terms — stored in localStorage.
 * Each entry has a singular and plural form.
 */

export type TermEntry = { singular: string; plural: string };

export interface Terms {
  // Módulos principais (pages)
  projeto:        TermEntry;
  bug:            TermEntry;
  relatorio:      TermEntry;
  execucao:       TermEntry;
  casoDeTeste:    TermEntry;
  planoDeTeste:   TermEntry;
  // Entidades internas
  item:           TermEntry;
  membro:         TermEntry;
  // Campos de execução / relatório
  ambiente:       TermEntry;
  build:          TermEntry;
  evidencia:      TermEntry;
  bugRelacionado: TermEntry;
  preCondicao:    TermEntry;
  // Abas do Dashboard QA
  qaOverview:     TermEntry;
  porQA:          TermEntry;
  porProjeto:     TermEntry;
  porBug:         TermEntry;
}

export const DEFAULT_TERMS: Terms = {
  // Módulos principais
  projeto:        { singular: "Projeto",        plural: "Projetos" },
  bug:            { singular: "Bug",            plural: "Bugs" },
  relatorio:      { singular: "Relatório",      plural: "Relatórios" },
  execucao:       { singular: "Execução",       plural: "Execuções" },
  casoDeTeste:    { singular: "Caso de Teste",  plural: "Casos de Teste" },
  planoDeTeste:   { singular: "Plano de Teste", plural: "Planos de Teste" },
  // Entidades internas
  item:           { singular: "Item",           plural: "Itens" },
  membro:         { singular: "Membro",         plural: "Membros" },
  // Campos
  ambiente:       { singular: "Ambiente",       plural: "Ambientes" },
  build:          { singular: "Build / Versão", plural: "Builds / Versões" },
  evidencia:      { singular: "Evidência",      plural: "Evidências" },
  bugRelacionado: { singular: "Bug Relacionado",plural: "Bugs Relacionados" },
  preCondicao:    { singular: "Pré-condição",   plural: "Pré-condições" },
  // Abas do Dashboard QA
  qaOverview:     { singular: "Visão Geral",    plural: "Visão Geral" },
  porQA:          { singular: "Por QA",         plural: "Por QA" },
  porProjeto:     { singular: "Por Projeto",    plural: "Por Projetos" },
  porBug:         { singular: "Por Bug",        plural: "Por Bugs" },
};

export const DEFAULT_TERMS_EN: Terms = {
  // Main modules
  projeto:        { singular: "Project",       plural: "Projects" },
  bug:            { singular: "Bug",           plural: "Bugs" },
  relatorio:      { singular: "Report",        plural: "Reports" },
  execucao:       { singular: "Execution",     plural: "Executions" },
  casoDeTeste:    { singular: "Test Case",     plural: "Test Cases" },
  planoDeTeste:   { singular: "Test Plan",     plural: "Test Plans" },
  // Internal entities
  item:           { singular: "Item",          plural: "Items" },
  membro:         { singular: "Member",        plural: "Members" },
  // Fields
  ambiente:       { singular: "Environment",   plural: "Environments" },
  build:          { singular: "Build / Version", plural: "Builds / Versions" },
  evidencia:      { singular: "Evidence",      plural: "Evidence" },
  bugRelacionado: { singular: "Related Bug",   plural: "Related Bugs" },
  preCondicao:    { singular: "Precondition",  plural: "Preconditions" },
  // QA Dashboard tabs
  qaOverview:     { singular: "Overview",      plural: "Overview" },
  porQA:          { singular: "By QA",         plural: "By QA" },
  porProjeto:     { singular: "By Project",    plural: "By Projects" },
  porBug:         { singular: "By Bug",        plural: "By Bugs" },
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
