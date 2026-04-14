import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser, getProjectsForUser } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  // ?all=true → Owner/Admin only; returns all org projects (used by Settings > Projects)
  const fetchAll = searchParams.get("all") === "true" &&
    (u.isSuperAdmin || u.orgRole === "OWNER" || u.orgRole === "ADMIN");

  // Build project visibility filter
  let projectIdFilter: string[] | null = null;
  if (!fetchAll && !u.isSuperAdmin && u.orgId && u.orgRole) {
    projectIdFilter = await getProjectsForUser(u.id, u.orgId, u.orgRole);
  }

  const projects = await prisma.project.findMany({
    where: {
      ...(u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {}),
      ...(activeOnly ? { isActive: true } : {}),
      ...(projectIdFilter !== null ? { id: { in: projectIdFilter } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true, cases: true, testPlans: true, executions: true, reports: true } } },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  // Only OWNER/ADMIN can create projects
  if (!u.isSuperAdmin && u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Sem permissão para criar projetos" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  let slug = slugify(name);
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      slug,
      organizationId: u.orgId ?? null,
    },
  });
  return NextResponse.json({ project }, { status: 201 });
}
