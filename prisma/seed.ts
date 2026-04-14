import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:./dev.db" });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("🌱 Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 10);

  // Super Admin (platform owner — no org needed)
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@testflow.com" },
    update: { isSuperAdmin: true },
    create: {
      name: "Super Admin",
      email: "superadmin@testflow.com",
      passwordHash,
      role: "ADMIN",
      isSuperAdmin: true,
    },
  });

  // Demo organization
  const org = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: { name: "Demo Org", slug: "demo-org", plan: "PRO", isActive: true, code: 1001 },
  });

  // Org owner / demo user
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@testflow.com" },
    update: {},
    create: {
      id: "demo-user-id",
      name: "Admin Demo",
      email: "admin@testflow.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.orgMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: adminUser.id } },
    update: {},
    create: { organizationId: org.id, userId: adminUser.id, role: "OWNER", joinedAt: new Date() },
  });

  // Demo project inside the org
  const project = await prisma.project.upsert({
    where: { slug: "demo-project" },
    update: {},
    create: {
      name: "Projeto Demo",
      description: "Projeto de demonstração do TestFlow",
      slug: "demo-project",
      organizationId: org.id,
    },
  });

  const module = await prisma.module.upsert({
    where: { projectId_name: { projectId: project.id, name: "Autenticação" } },
    update: {},
    create: {
      name: "Autenticação",
      description: "Módulo de login e autenticação",
      projectId: project.id,
    },
  });

  const item = await prisma.item.upsert({
    where: { id: "demo-item-id" },
    update: {},
    create: {
      id: "demo-item-id",
      title: "US-001 - Login de Usuário",
      description: "Como usuário, quero realizar login no sistema com email e senha para acessar as funcionalidades.",
      type: "USER_STORY",
      priority: "HIGH",
      projectId: project.id,
      moduleId: module.id,
      organizationId: org.id,
      reference: "US-001",
      acceptanceCriteria:
        "1. O usuário deve conseguir logar com credenciais válidas\n2. Deve exibir erro para credenciais inválidas\n3. Deve redirecionar para o dashboard após login bem-sucedido",
      authorId: adminUser.id,
    },
  });

  const case1 = await prisma.testCase.upsert({
    where: { id: "demo-case-1" },
    update: {},
    create: {
      id: "demo-case-1",
      title: "CT-001 - Login com credenciais válidas",
      format: "BDD",
      precondition: "Usuário cadastrado no sistema com email e senha",
      priority: "HIGH",
      projectId: project.id,
      moduleId: module.id,
      itemId: item.id,
      organizationId: org.id,
      authorId: adminUser.id,
      bddGiven: "O usuário está na tela de login",
      bddWhen: "O usuário informa email 'admin@testflow.com' e senha 'admin123' e clica em Entrar",
      bddThen: "O sistema deve redirecionar para o Dashboard",
    },
  });

  await prisma.testCase.upsert({
    where: { id: "demo-case-2" },
    update: {},
    create: {
      id: "demo-case-2",
      title: "CT-002 - Login com senha incorreta",
      format: "BDD",
      precondition: "Usuário cadastrado no sistema",
      priority: "HIGH",
      projectId: project.id,
      moduleId: module.id,
      itemId: item.id,
      organizationId: org.id,
      authorId: adminUser.id,
      bddGiven: "O usuário está na tela de login",
      bddWhen: "O usuário informa email válido e senha incorreta",
      bddThen: "O sistema deve exibir a mensagem 'Email ou senha inválidos'",
    },
  });

  const case3 = await prisma.testCase.upsert({
    where: { id: "demo-case-3" },
    update: {},
    create: {
      id: "demo-case-3",
      title: "CT-003 - Fluxo completo de login",
      format: "STEP_BY_STEP",
      precondition: "Sistema em execução, usuário cadastrado",
      priority: "MEDIUM",
      projectId: project.id,
      moduleId: module.id,
      itemId: item.id,
      organizationId: org.id,
      authorId: adminUser.id,
      expectedResult: "Usuário autenticado e redirecionado ao Dashboard",
    },
  });

  await prisma.testStep.deleteMany({ where: { caseId: case3.id } });
  await prisma.testStep.createMany({
    data: [
      { caseId: case3.id, order: 1, description: "Acessar a URL da aplicação" },
      { caseId: case3.id, order: 2, description: "Verificar que a tela de login é exibida" },
      { caseId: case3.id, order: 3, description: "Inserir o email no campo Email" },
      { caseId: case3.id, order: 4, description: "Inserir a senha no campo Senha" },
      { caseId: case3.id, order: 5, description: "Clicar no botão Entrar" },
      { caseId: case3.id, order: 6, description: "Verificar o redirecionamento para o Dashboard" },
    ],
  });

  await prisma.execution.upsert({
    where: { id: "demo-exec-1" },
    update: {},
    create: {
      id: "demo-exec-1",
      caseId: case1.id,
      projectId: project.id,
      organizationId: org.id,
      executorId: adminUser.id,
      status: "PASS",
      environment: "QA",
      buildVersion: "v1.0.0",
      executedAt: new Date(),
    },
  });

  await prisma.execution.upsert({
    where: { id: "demo-exec-2" },
    update: {},
    create: {
      id: "demo-exec-2",
      caseId: case3.id,
      projectId: project.id,
      organizationId: org.id,
      executorId: adminUser.id,
      status: "FAIL",
      environment: "QA",
      buildVersion: "v1.0.0",
      notes: "O sistema não redireciona corretamente após login",
      relatedBugRef: "BUG-042",
      executedAt: new Date(),
    },
  });

  console.log("✅ Seed concluído!");
  console.log("");
  console.log("🔑 Contas criadas:");
  console.log("   Super Admin  → superadmin@testflow.com / admin123");
  console.log("   Org Owner    → admin@testflow.com       / admin123  (org: Demo Org)");
  console.log("");
  console.log(`   superAdmin id: ${superAdmin.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
