export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "TestFlow API",
    description:
      "API completa do TestFlow — plataforma de gestão de qualidade de software com geração de casos de teste e bugs por IA.\n\n" +
      "## Autenticação\n" +
      "Todas as rotas (exceto `/api/auth`) requerem uma sessão autenticada via cookie de sessão NextAuth.\n\n" +
      "## Permissões\n" +
      "| Papel | Descrição |\n" +
      "|---|---|\n" +
      "| `SUPER_ADMIN` | Acesso total ao painel admin |\n" +
      "| `OWNER` | Dono da organização |\n" +
      "| `ADMIN` | Administrador da organização |\n" +
      "| `MEMBER` | Membro padrão |",
    version: "1.0.0",
    contact: { name: "TestFlow", email: "suporte@testflow.app" },
  },
  servers: [
    { url: "https://testflow.vercel.app", description: "Produção" },
    { url: "http://localhost:3000", description: "Local" },
  ],
  tags: [
    { name: "Projetos", description: "Gestão de projetos e módulos" },
    { name: "Casos de Teste", description: "Criação e gestão de casos de teste" },
    { name: "Geração IA", description: "Geração de casos e bugs via inteligência artificial" },
    { name: "Planos de Teste", description: "Planos de execução de testes" },
    { name: "Execuções", description: "Resultados de execução de casos de teste" },
    { name: "Evidências", description: "Evidências de execução (imagens, links, arquivos)" },
    { name: "Relatórios", description: "Relatórios de teste e PDF" },
    { name: "Itens", description: "User stories, bugs e requisitos" },
    { name: "Bugs", description: "Gestão de bugs reportados" },
    { name: "Organização", description: "Dados e membros da organização" },
    { name: "Admin", description: "Painel super admin — gestão de organizações e admins" },
    { name: "Usuário", description: "Perfil do usuário autenticado" },
    { name: "Dashboard", description: "Métricas e estatísticas" },
    { name: "IA / Configuração", description: "Status e configuração do provedor de IA" },
    { name: "Upload", description: "Upload e acesso a arquivos" },
  ],
  paths: {
    // ─── PROJETOS ────────────────────────────────────────────────────
    "/api/projects": {
      get: {
        tags: ["Projetos"],
        summary: "Listar projetos",
        description: "Retorna os projetos da organização do usuário autenticado.",
        parameters: [
          { name: "activeOnly", in: "query", schema: { type: "boolean" }, description: "Se `true`, retorna apenas projetos ativos" },
          { name: "all", in: "query", schema: { type: "boolean" }, description: "Se `true`, retorna todos os projetos (Owner/Admin)" },
        ],
        responses: {
          200: { description: "Lista de projetos", content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectList" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Projetos"],
        summary: "Criar projeto",
        description: "Cria um novo projeto. Requer papel Owner ou Admin.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectCreate" } } } },
        responses: {
          200: { description: "Projeto criado", content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/projects/{id}": {
      patch: {
        tags: ["Projetos"],
        summary: "Atualizar projeto",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectUpdate" } } } },
        responses: {
          200: { description: "Projeto atualizado", content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } } },
          403: { $ref: "#/components/responses/Forbidden" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Projetos"],
        summary: "Deletar projeto",
        description: "Remove o projeto. Falha se houver itens vinculados.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Projeto removido" },
          400: { description: "Projeto possui itens vinculados" },
          403: { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/projects/{id}/modules": {
      get: {
        tags: ["Projetos"],
        summary: "Listar módulos do projeto",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Lista de módulos", content: { "application/json": { schema: { type: "object", properties: { modules: { type: "array", items: { $ref: "#/components/schemas/Module" } } } } } } },
        },
      },
      post: {
        tags: ["Projetos"],
        summary: "Criar módulo",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string", example: "Autenticação" } } } } } },
        responses: {
          200: { description: "Módulo criado", content: { "application/json": { schema: { $ref: "#/components/schemas/Module" } } } },
        },
      },
    },

    // ─── CASOS DE TESTE ───────────────────────────────────────────────
    "/api/cases": {
      get: {
        tags: ["Casos de Teste"],
        summary: "Listar casos de teste",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Busca por título" },
          { name: "format", in: "query", schema: { type: "string", enum: ["BDD", "STEP_BY_STEP"] } },
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: { description: "Lista de casos", content: { "application/json": { schema: { $ref: "#/components/schemas/CaseList" } } } },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Casos de Teste"],
        summary: "Criar caso de teste",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CaseCreate" } } } },
        responses: {
          200: { description: "Caso criado", content: { "application/json": { schema: { $ref: "#/components/schemas/TestCase" } } } },
        },
      },
    },
    "/api/cases/{id}": {
      get: {
        tags: ["Casos de Teste"],
        summary: "Buscar caso de teste",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Caso de teste", content: { "application/json": { schema: { $ref: "#/components/schemas/TestCase" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Casos de Teste"],
        summary: "Atualizar caso de teste",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CaseUpdate" } } } },
        responses: {
          200: { description: "Caso atualizado", content: { "application/json": { schema: { $ref: "#/components/schemas/TestCase" } } } },
        },
      },
      delete: {
        tags: ["Casos de Teste"],
        summary: "Deletar caso de teste (soft delete)",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Caso desativado" },
        },
      },
    },
    "/api/cases/bulk": {
      post: {
        tags: ["Casos de Teste"],
        summary: "Criar múltiplos casos",
        description: "Cria vários casos de teste de uma só vez.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["cases", "projectId"],
                properties: {
                  cases: { type: "array", items: { $ref: "#/components/schemas/CaseCreate" } },
                  projectId: { type: "string" },
                  itemId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Casos criados", content: { "application/json": { schema: { type: "object", properties: { created: { type: "array", items: { $ref: "#/components/schemas/TestCase" } }, count: { type: "integer" } } } } } },
        },
      },
      delete: {
        tags: ["Casos de Teste"],
        summary: "Deletar múltiplos casos",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } } } } } } },
        responses: {
          200: { description: "Casos removidos" },
        },
      },
    },

    // ─── GERAÇÃO IA ───────────────────────────────────────────────────
    "/api/cases/generate": {
      post: {
        tags: ["Geração IA"],
        summary: "Gerar casos de teste com IA",
        description: "Gera casos de teste automaticamente usando o provedor de IA configurado (Manus, OpenAI ou Claude). Deve fornecer `itemId` ou `manualDescription`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenerateCasesRequest" },
              example: {
                manualDescription: "Tela de login com e-mail e senha. Validação de campos obrigatórios e mensagem de erro para credenciais inválidas.",
                quantity: 5,
                format: "BDD",
                language: "pt-BR",
                coverageLevel: "standard",
                testType: "functional",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Casos gerados",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenerateCasesResponse" },
              },
            },
          },
          400: { description: "Descrição ou item não fornecido" },
          503: { description: "Provedor de IA indisponível ou não configurado" },
        },
      },
    },
    "/api/bugs/generate": {
      post: {
        tags: ["Geração IA"],
        summary: "Gerar bugs com IA",
        description: "Gera relatórios de bug automaticamente usando o provedor de IA configurado.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenerateBugsRequest" },
              example: {
                manualDescription: "Sistema de filtro de relatórios por data.",
                quantity: 3,
                language: "pt-BR",
                priority: "mixed",
                bugCategory: "functional",
              },
            },
          },
        },
        responses: {
          200: { description: "Bugs gerados", content: { "application/json": { schema: { $ref: "#/components/schemas/GenerateBugsResponse" } } } },
          503: { description: "Provedor de IA indisponível" },
        },
      },
    },

    // ─── PLANOS DE TESTE ──────────────────────────────────────────────
    "/api/test-plans": {
      get: {
        tags: ["Planos de Teste"],
        summary: "Listar planos de teste",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED"] } },
          { name: "projectId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Lista de planos", content: { "application/json": { schema: { $ref: "#/components/schemas/TestPlanList" } } } },
        },
      },
      post: {
        tags: ["Planos de Teste"],
        summary: "Criar plano de teste",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "projectId", "caseIds"],
                properties: {
                  name: { type: "string", example: "Sprint 12 — Regressão" },
                  projectId: { type: "string" },
                  caseIds: { type: "array", items: { type: "string" }, description: "IDs dos casos de teste a incluir" },
                  environment: { type: "string", example: "Staging" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Plano criado", content: { "application/json": { schema: { $ref: "#/components/schemas/TestPlan" } } } },
        },
      },
    },
    "/api/test-plans/{id}": {
      get: {
        tags: ["Planos de Teste"],
        summary: "Buscar plano de teste",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Plano completo com itens e execuções", content: { "application/json": { schema: { $ref: "#/components/schemas/TestPlan" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Planos de Teste"],
        summary: "Atualizar plano de teste",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
                  result: { type: "string", enum: ["PASSED", "FAILED", "BLOCKED"] },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Plano atualizado" },
        },
      },
      delete: {
        tags: ["Planos de Teste"],
        summary: "Deletar plano de teste",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Plano removido" },
        },
      },
    },
    "/api/test-plans/{id}/items/{itemId}": {
      delete: {
        tags: ["Planos de Teste"],
        summary: "Remover caso do plano",
        description: "Remove um caso de teste de um plano em execução. Também remove o resultado de execução associado.",
        parameters: [
          { $ref: "#/components/parameters/Id" },
          { name: "itemId", in: "path", required: true, schema: { type: "string" }, description: "ID do TestPlanCase" },
        ],
        responses: {
          200: { description: "Caso removido do plano" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ─── EXECUÇÕES ────────────────────────────────────────────────────
    "/api/executions": {
      get: {
        tags: ["Execuções"],
        summary: "Listar execuções",
        parameters: [
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: { description: "Lista de execuções", content: { "application/json": { schema: { $ref: "#/components/schemas/ExecutionList" } } } },
        },
      },
      post: {
        tags: ["Execuções"],
        summary: "Criar execução",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["caseId", "testPlanId", "status"],
                properties: {
                  caseId: { type: "string" },
                  testPlanId: { type: "string" },
                  status: { type: "string", enum: ["PASSED", "FAILED", "BLOCKED", "SKIPPED"] },
                  notes: { type: "string" },
                  relatedBugRef: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Execução registrada", content: { "application/json": { schema: { $ref: "#/components/schemas/Execution" } } } },
        },
      },
    },
    "/api/executions/{id}": {
      patch: {
        tags: ["Execuções"],
        summary: "Atualizar execução",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["PASSED", "FAILED", "BLOCKED", "SKIPPED"] },
                  notes: { type: "string" },
                  relatedBugRef: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Execução atualizada" },
        },
      },
      delete: {
        tags: ["Execuções"],
        summary: "Deletar execução",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Execução removida" },
        },
      },
    },

    // ─── EVIDÊNCIAS ───────────────────────────────────────────────────
    "/api/evidence": {
      post: {
        tags: ["Evidências"],
        summary: "Criar evidência",
        description: "Associa uma evidência (imagem, link ou arquivo) a uma execução.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["executionId", "type"],
                properties: {
                  executionId: { type: "string" },
                  type: { type: "string", enum: ["IMAGE", "LINK", "FILE"] },
                  url: { type: "string", description: "URL da evidência (para IMAGE e LINK)" },
                  storageKey: { type: "string", description: "Chave do arquivo no storage" },
                  filename: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Evidência criada" },
        },
      },
    },

    // ─── RELATÓRIOS ───────────────────────────────────────────────────
    "/api/reports": {
      get: {
        tags: ["Relatórios"],
        summary: "Listar relatórios",
        responses: {
          200: { description: "Lista de relatórios", content: { "application/json": { schema: { $ref: "#/components/schemas/ReportList" } } } },
        },
      },
      post: {
        tags: ["Relatórios"],
        summary: "Gerar relatório",
        description: "Gera um relatório a partir de um plano de teste concluído.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["testPlanId"],
                properties: {
                  testPlanId: { type: "string" },
                  title: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Relatório gerado", content: { "application/json": { schema: { $ref: "#/components/schemas/Report" } } } },
        },
      },
    },
    "/api/reports/{id}": {
      get: {
        tags: ["Relatórios"],
        summary: "Buscar relatório",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Relatório completo", content: { "application/json": { schema: { $ref: "#/components/schemas/Report" } } } },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Relatórios"],
        summary: "Deletar relatório",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { 200: { description: "Relatório removido" } },
      },
    },
    "/api/reports/{id}/pdf": {
      get: {
        tags: ["Relatórios"],
        summary: "Relatório em HTML/PDF",
        description: "Retorna HTML formatado para impressão/PDF com métricas, tabelas de casos e evidências.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Página HTML para impressão", content: { "text/html": { schema: { type: "string" } } } },
        },
      },
    },

    // ─── ITENS ────────────────────────────────────────────────────────
    "/api/items": {
      get: {
        tags: ["Itens"],
        summary: "Listar itens",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["USER_STORY", "BUG", "TASK", "EPIC"] } },
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "moduleId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: { description: "Lista de itens", content: { "application/json": { schema: { $ref: "#/components/schemas/ItemList" } } } },
        },
      },
      post: {
        tags: ["Itens"],
        summary: "Criar item",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ItemCreate" } } } },
        responses: {
          200: { description: "Item criado", content: { "application/json": { schema: { $ref: "#/components/schemas/Item" } } } },
        },
      },
    },
    "/api/items/{id}": {
      get: {
        tags: ["Itens"],
        summary: "Buscar item",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Item com módulo e projeto", content: { "application/json": { schema: { $ref: "#/components/schemas/Item" } } } },
        },
      },
      patch: {
        tags: ["Itens"],
        summary: "Atualizar item",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ItemUpdate" } } } },
        responses: {
          200: { description: "Item atualizado" },
        },
      },
      delete: {
        tags: ["Itens"],
        summary: "Deletar item",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { 200: { description: "Item removido" } },
      },
    },

    // ─── BUGS ─────────────────────────────────────────────────────────
    "/api/bugs": {
      get: {
        tags: ["Bugs"],
        summary: "Listar bugs",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Busca por título" },
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: { description: "Lista de bugs", content: { "application/json": { schema: { $ref: "#/components/schemas/BugList" } } } },
        },
      },
      post: {
        tags: ["Bugs"],
        summary: "Criar bug",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/BugCreate" } } } },
        responses: {
          200: { description: "Bug criado", content: { "application/json": { schema: { $ref: "#/components/schemas/Bug" } } } },
        },
      },
    },
    "/api/bugs/bulk": {
      post: {
        tags: ["Bugs"],
        summary: "Criar múltiplos bugs",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["bugs", "projectId"],
                properties: {
                  projectId: { type: "string" },
                  bugs: { type: "array", items: { $ref: "#/components/schemas/BugCreate" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Bugs criados", content: { "application/json": { schema: { type: "object", properties: { count: { type: "integer" } } } } } },
        },
      },
    },

    // ─── ORGANIZAÇÃO ─────────────────────────────────────────────────
    "/api/orgs/me": {
      get: {
        tags: ["Organização"],
        summary: "Dados da organização atual",
        responses: {
          200: { description: "Organização do usuário autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/OrgMe" } } } },
        },
      },
    },
    "/api/orgs/members": {
      get: {
        tags: ["Organização"],
        summary: "Listar membros",
        responses: {
          200: { description: "Lista de membros com projetos", content: { "application/json": { schema: { $ref: "#/components/schemas/MemberList" } } } },
        },
      },
      post: {
        tags: ["Organização"],
        summary: "Convidar membro",
        description: "Cria o usuário se não existir e envia e-mail de boas-vindas.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "role"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  role: { type: "string", enum: ["ADMIN", "MEMBER"] },
                  password: { type: "string", description: "Senha temporária (gerada automaticamente se não fornecida)" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Membro adicionado" },
          409: { description: "E-mail já é membro da organização" },
        },
      },
    },
    "/api/orgs/members/{memberId}": {
      patch: {
        tags: ["Organização"],
        summary: "Atualizar membro",
        parameters: [{ name: "memberId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["ADMIN", "MEMBER"] },
                  skills: { type: "string" },
                  status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Membro atualizado" } },
      },
      delete: {
        tags: ["Organização"],
        summary: "Remover membro",
        parameters: [{ name: "memberId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Membro removido" } },
      },
    },
    "/api/orgs/members/{memberId}/reset-password": {
      post: {
        tags: ["Organização"],
        summary: "Resetar senha do membro",
        description: "Gera uma senha temporária e envia por e-mail. Apenas Owner.",
        parameters: [{ name: "memberId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "E-mail enviado com nova senha" } },
      },
    },
    "/api/orgs/role-names": {
      get: {
        tags: ["Organização"],
        summary: "Buscar nomes de papéis customizados",
        responses: { 200: { description: "Nomes personalizados dos papéis" } },
      },
      patch: {
        tags: ["Organização"],
        summary: "Atualizar nomes de papéis",
        description: "Apenas Owner.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ownerName: { type: "string" },
                  adminName: { type: "string" },
                  memberName: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Nomes atualizados" } },
      },
    },
    "/api/orgs/projects/{id}/members": {
      get: {
        tags: ["Organização"],
        summary: "Listar membros do projeto",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { 200: { description: "Membros do projeto" } },
      },
      post: {
        tags: ["Organização"],
        summary: "Adicionar membro ao projeto",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["userId"], properties: { userId: { type: "string" } } } } } },
        responses: { 200: { description: "Membro adicionado ao projeto" } },
      },
      delete: {
        tags: ["Organização"],
        summary: "Remover membro do projeto",
        parameters: [
          { $ref: "#/components/parameters/Id" },
          { name: "userId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Membro removido do projeto" } },
      },
    },
    "/api/orgs/features": {
      get: {
        tags: ["Organização"],
        summary: "Buscar feature flags da org",
        responses: { 200: { description: "Flags de funcionalidades ativas" } },
      },
      patch: {
        tags: ["Organização"],
        summary: "Atualizar feature flags",
        description: "Apenas Owner.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  overviewEnabled: { type: "boolean" },
                  qaDashboardEnabled: { type: "boolean" },
                  overviewName: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Flags atualizadas" } },
      },
    },

    // ─── ADMIN ────────────────────────────────────────────────────────
    "/api/admin/orgs": {
      get: {
        tags: ["Admin"],
        summary: "Listar organizações (Super Admin)",
        responses: { 200: { description: "Lista de todas as organizações" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Criar organização (Super Admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "ownerName", "ownerEmail"],
                properties: {
                  name: { type: "string", example: "Acme Corp" },
                  ownerName: { type: "string" },
                  ownerEmail: { type: "string", format: "email" },
                  ownerPassword: { type: "string" },
                  plan: { type: "string", enum: ["FREE", "PRO", "ENTERPRISE"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Organização criada com credenciais do owner" } },
      },
    },
    "/api/admin/orgs/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Detalhes da organização (Super Admin)",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { 200: { description: "Org com membros e projetos" } },
      },
      patch: {
        tags: ["Admin"],
        summary: "Atualizar organização (Super Admin)",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  plan: { type: "string", enum: ["FREE", "PRO", "ENTERPRISE"] },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Organização atualizada" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Deletar organização (Super Admin)",
        description: "Remove a organização e todos os seus dados em cascata.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { 200: { description: "Organização deletada" } },
      },
    },
    "/api/admin/orgs/{id}/members": {
      post: {
        tags: ["Admin"],
        summary: "Adicionar membro à org (Super Admin)",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "role"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  role: { type: "string", enum: ["OWNER", "ADMIN", "MEMBER"] },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Membro adicionado" } },
      },
    },
    "/api/admin/orgs/{id}/members/{memberId}": {
      patch: {
        tags: ["Admin"],
        summary: "Alterar papel do membro (Super Admin)",
        parameters: [
          { $ref: "#/components/parameters/Id" },
          { name: "memberId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { role: { type: "string", enum: ["OWNER", "ADMIN", "MEMBER"] } } } } } },
        responses: { 200: { description: "Papel alterado" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Remover membro da org (Super Admin)",
        parameters: [
          { $ref: "#/components/parameters/Id" },
          { name: "memberId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Membro removido" } },
      },
    },
    "/api/admin/superadmins": {
      get: {
        tags: ["Admin"],
        summary: "Listar super admins",
        responses: { 200: { description: "Lista de usuários com isSuperAdmin=true" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Criar super admin",
        description: "Cria novo usuário super admin ou promove um existente.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Super admin criado ou promovido" },
          409: { description: "E-mail já é super admin" },
        },
      },
    },
    "/api/admin/superadmins/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Revogar super admin",
        description: "Revoga o status de super admin. Se o usuário não tiver vínculos com orgs, é deletado.",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Super admin revogado/deletado" },
          400: { description: "Não é possível remover a si mesmo" },
        },
      },
    },

    // ─── USUÁRIO ──────────────────────────────────────────────────────
    "/api/user/profile": {
      get: {
        tags: ["Usuário"],
        summary: "Buscar perfil",
        responses: {
          200: {
            description: "Perfil do usuário logado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Usuário"],
        summary: "Atualizar perfil",
        description: "Atualiza nome, e-mail ou senha. Requer senha atual para qualquer alteração.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  newPassword: { type: "string", minLength: 6 },
                  currentPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Perfil atualizado" },
          400: { description: "Senha atual incorreta" },
        },
      },
    },

    // ─── DASHBOARD ────────────────────────────────────────────────────
    "/api/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Métricas gerais",
        responses: {
          200: {
            description: "Contadores, taxa de aprovação, distribuição de status, planos e relatórios recentes",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DashboardStats" },
              },
            },
          },
        },
      },
    },
    "/api/dashboard/qa": {
      get: {
        tags: ["Dashboard"],
        summary: "Dashboard QA",
        description: "Métricas focadas em bugs e QA. Requer papel Owner ou Admin.",
        parameters: [
          { name: "projectId", in: "query", schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string" } },
          { name: "bugStatus", in: "query", schema: { type: "string" } },
          { name: "bugPriority", in: "query", schema: { type: "string" } },
          { name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "90d"] }, description: "Período para filtrar dados" },
        ],
        responses: {
          200: { description: "Métricas de bugs, planos e relatórios por projeto/QA" },
        },
      },
    },

    // ─── IA / CONFIGURAÇÃO ────────────────────────────────────────────
    "/api/ai-status": {
      get: {
        tags: ["IA / Configuração"],
        summary: "Status do provedor de IA",
        responses: {
          200: {
            description: "Status atual da IA configurada",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["online", "configured", "offline", "mock"] },
                    provider: { type: "string", enum: ["openai", "manus", "claude", "none"] },
                    model: { type: "string" },
                    url: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/settings/ai": {
      get: {
        tags: ["IA / Configuração"],
        summary: "Configuração de IA (Super Admin)",
        responses: {
          200: { description: "Configuração com chaves mascaradas", content: { "application/json": { schema: { $ref: "#/components/schemas/AIConfig" } } } },
        },
      },
      post: {
        tags: ["IA / Configuração"],
        summary: "Salvar configuração de IA (Super Admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AIConfigUpdate" },
            },
          },
        },
        responses: { 200: { description: "Configuração salva" } },
      },
    },

    // ─── UPLOAD ───────────────────────────────────────────────────────
    "/api/upload": {
      post: {
        tags: ["Upload"],
        summary: "Upload de arquivo",
        description: "Tipos permitidos: `jpg`, `jpeg`, `png`, `gif`, `webp`, `pdf`, `log`, `txt`.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Arquivo enviado",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", example: "/api/uploads/abc123.png" },
                    filename: { type: "string" },
                    originalName: { type: "string" },
                    size: { type: "integer" },
                  },
                },
              },
            },
          },
          400: { description: "Tipo de arquivo não permitido" },
        },
      },
    },
    "/api/uploads/{filename}": {
      get: {
        tags: ["Upload"],
        summary: "Acessar arquivo enviado",
        parameters: [{ name: "filename", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Conteúdo do arquivo com Content-Type correto e cache headers" },
          400: { description: "Nome de arquivo inválido (path traversal bloqueado)" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },

  components: {
    parameters: {
      Id: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "ID do recurso",
      },
    },
    responses: {
      Unauthorized: {
        description: "Sessão inválida ou ausente",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Forbidden: {
        description: "Sem permissão para esta ação",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Recurso não encontrado",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" },
        },
      },

      // ── Project ──
      Project: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "App Mobile" },
          description: { type: "string" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ProjectList: {
        type: "object",
        properties: {
          projects: { type: "array", items: { $ref: "#/components/schemas/Project" } },
        },
      },
      ProjectCreate: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Portal do Cliente" },
          description: { type: "string" },
        },
      },
      ProjectUpdate: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          isActive: { type: "boolean" },
        },
      },
      Module: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "Autenticação" },
          projectId: { type: "string" },
        },
      },

      // ── Test Case ──
      TestCase: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string", example: "Login com credenciais válidas" },
          priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          format: { type: "string", enum: ["BDD", "STEP_BY_STEP"] },
          precondition: { type: "string", nullable: true },
          bddGiven: { type: "string", nullable: true },
          bddWhen: { type: "string", nullable: true },
          bddThen: { type: "string", nullable: true },
          steps: { type: "array", items: { type: "object", properties: { order: { type: "integer" }, description: { type: "string" } } } },
          expectedResult: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          projectId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CaseList: {
        type: "object",
        properties: {
          cases: { type: "array", items: { $ref: "#/components/schemas/TestCase" } },
          total: { type: "integer" },
        },
      },
      CaseCreate: {
        type: "object",
        required: ["title", "format"],
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"], default: "MEDIUM" },
          format: { type: "string", enum: ["BDD", "STEP_BY_STEP"] },
          precondition: { type: "string" },
          bddGiven: { type: "string" },
          bddWhen: { type: "string" },
          bddThen: { type: "string" },
          steps: { type: "array", items: { type: "object", properties: { order: { type: "integer" }, description: { type: "string" } } } },
          expectedResult: { type: "string" },
          notes: { type: "string" },
          projectId: { type: "string" },
          itemId: { type: "string" },
        },
      },
      CaseUpdate: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          precondition: { type: "string" },
          bddGiven: { type: "string" },
          bddWhen: { type: "string" },
          bddThen: { type: "string" },
          steps: { type: "array", items: { type: "object", properties: { order: { type: "integer" }, description: { type: "string" } } } },
          expectedResult: { type: "string" },
          notes: { type: "string" },
        },
      },

      // ── Test Plan ──
      TestPlan: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", example: "Sprint 12 — Regressão" },
          environment: { type: "string", nullable: true },
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
          result: { type: "string", enum: ["PASSED", "FAILED", "BLOCKED"], nullable: true },
          notes: { type: "string", nullable: true },
          projectId: { type: "string" },
          startedAt: { type: "string", format: "date-time", nullable: true },
          completedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      TestPlanList: {
        type: "object",
        properties: {
          plans: { type: "array", items: { $ref: "#/components/schemas/TestPlan" } },
        },
      },

      // ── Execution ──
      Execution: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["PASSED", "FAILED", "BLOCKED", "SKIPPED"] },
          notes: { type: "string", nullable: true },
          relatedBugRef: { type: "string", nullable: true },
          caseId: { type: "string" },
          testPlanId: { type: "string" },
          executedAt: { type: "string", format: "date-time" },
        },
      },
      ExecutionList: {
        type: "object",
        properties: {
          executions: { type: "array", items: { $ref: "#/components/schemas/Execution" } },
        },
      },

      // ── Report ──
      Report: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          passRate: { type: "number", format: "float", example: 87.5 },
          totalCases: { type: "integer" },
          passedCases: { type: "integer" },
          failedCases: { type: "integer" },
          blockedCases: { type: "integer" },
          projectId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ReportList: {
        type: "object",
        properties: {
          reports: { type: "array", items: { $ref: "#/components/schemas/Report" } },
        },
      },

      // ── Item ──
      Item: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          type: { type: "string", enum: ["USER_STORY", "BUG", "TASK", "EPIC"] },
          priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] },
          description: { type: "string", nullable: true },
          acceptanceCriteria: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          projectId: { type: "string" },
          moduleId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ItemList: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/Item" } },
          total: { type: "integer" },
        },
      },
      ItemCreate: {
        type: "object",
        required: ["title", "type", "projectId"],
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["USER_STORY", "BUG", "TASK", "EPIC"] },
          priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          description: { type: "string" },
          acceptanceCriteria: { type: "string" },
          notes: { type: "string" },
          projectId: { type: "string" },
          moduleId: { type: "string" },
        },
      },
      ItemUpdate: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["USER_STORY", "BUG", "TASK", "EPIC"] },
          priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] },
          description: { type: "string" },
          acceptanceCriteria: { type: "string" },
          notes: { type: "string" },
          moduleId: { type: "string" },
        },
      },

      // ── Bug ──
      Bug: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string", example: "Filtro de data não retorna resultados acima de 90 dias" },
          description: { type: "string" },
          priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          status: { type: "string", enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] },
          acceptanceCriteria: { type: "string", description: "Passos para reproduzir" },
          notes: { type: "string", nullable: true },
          projectId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      BugList: {
        type: "object",
        properties: {
          bugs: { type: "array", items: { $ref: "#/components/schemas/Bug" } },
          total: { type: "integer" },
        },
      },
      BugCreate: {
        type: "object",
        required: ["title", "projectId"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"], default: "MEDIUM" },
          acceptanceCriteria: { type: "string", description: "Passos para reproduzir" },
          notes: { type: "string" },
          projectId: { type: "string" },
        },
      },

      // ── Org ──
      OrgMe: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
          slug: { type: "string" },
          plan: { type: "string", enum: ["FREE", "PRO", "ENTERPRISE"] },
          isActive: { type: "boolean" },
          memberCount: { type: "integer" },
          projectCount: { type: "integer" },
        },
      },
      MemberList: {
        type: "object",
        properties: {
          members: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                role: { type: "string", enum: ["OWNER", "ADMIN", "MEMBER"] },
                status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
                user: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string" } } },
                projects: { type: "array", items: { $ref: "#/components/schemas/Project" } },
              },
            },
          },
        },
      },

      // ── AI ──
      AIConfig: {
        type: "object",
        properties: {
          activeProvider: { type: "string", enum: ["openai", "manus", "claude", "none"] },
          openai: {
            type: "object",
            properties: {
              configured: { type: "boolean" },
              maskedKey: { type: "string", example: "sk-...ab12" },
              model: { type: "string", example: "gpt-4o" },
            },
          },
          claude: {
            type: "object",
            properties: {
              configured: { type: "boolean" },
              maskedKey: { type: "string" },
              model: { type: "string", example: "claude-sonnet-4-6" },
            },
          },
          manus: {
            type: "object",
            properties: {
              configured: { type: "boolean" },
              maskedKey: { type: "string" },
              baseUrl: { type: "string" },
            },
          },
        },
      },
      AIConfigUpdate: {
        type: "object",
        properties: {
          activeProvider: { type: "string", enum: ["openai", "manus", "claude", "none"] },
          openaiKey: { type: "string" },
          openaiModel: { type: "string" },
          claudeKey: { type: "string" },
          claudeModel: { type: "string" },
          manusKey: { type: "string" },
          manusBaseUrl: { type: "string" },
        },
      },

      // ── Generate ──
      GenerateCasesRequest: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "ID de um item cadastrado (opcional se manualDescription fornecido)" },
          manualDescription: { type: "string", description: "Descrição manual do requisito" },
          quantity: { type: "integer", minimum: 1, maximum: 30, default: 5 },
          format: { type: "string", enum: ["BDD", "STEP_BY_STEP"], default: "BDD" },
          language: { type: "string", enum: ["pt-BR", "en", "es"], default: "pt-BR" },
          coverageLevel: { type: "string", enum: ["basic", "standard", "comprehensive"], default: "standard" },
          testType: { type: "string", enum: ["functional", "integration", "e2e", "regression", "smoke"], default: "functional" },
          projectId: { type: "string" },
        },
      },
      GenerateCasesResponse: {
        type: "object",
        properties: {
          cases: { type: "array", items: { $ref: "#/components/schemas/TestCase" } },
          provider: { type: "string", enum: ["openai", "manus", "claude"] },
          model: { type: "string" },
        },
      },
      GenerateBugsRequest: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          manualDescription: { type: "string" },
          quantity: { type: "integer", minimum: 1, maximum: 20, default: 3 },
          language: { type: "string", enum: ["pt-BR", "en", "es"], default: "pt-BR" },
          priority: { type: "string", enum: ["mixed", "CRITICAL", "HIGH", "MEDIUM", "LOW"], default: "mixed" },
          bugCategory: { type: "string", enum: ["functional", "ui", "performance", "security", "integration", "data", "accessibility"], default: "functional" },
          projectId: { type: "string" },
        },
      },
      GenerateBugsResponse: {
        type: "object",
        properties: {
          bugs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
                stepsToReproduce: { type: "string" },
                expectedResult: { type: "string" },
                actualResult: { type: "string" },
                affectedArea: { type: "string" },
                notes: { type: "string", nullable: true },
              },
            },
          },
        },
      },

      // ── Dashboard ──
      DashboardStats: {
        type: "object",
        properties: {
          itemCount: { type: "integer" },
          caseCount: { type: "integer" },
          executionCount: { type: "integer" },
          passRate: { type: "number", format: "float" },
          statusDistribution: {
            type: "object",
            properties: {
              PASSED: { type: "integer" },
              FAILED: { type: "integer" },
              BLOCKED: { type: "integer" },
              SKIPPED: { type: "integer" },
            },
          },
          recentPlans: { type: "array", items: { $ref: "#/components/schemas/TestPlan" } },
          recentReports: { type: "array", items: { $ref: "#/components/schemas/Report" } },
        },
      },
    },
  },
};
