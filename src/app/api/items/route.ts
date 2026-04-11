import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-id";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const limit = Number(searchParams.get("limit") ?? "50");

  const items = await prisma.item.findMany({
    where: {
      project: { isActive: true },
      ...(q && { OR: [{ title: { contains: q } }, { description: { contains: q } }] }),
      ...(type && { type }),
      ...(projectId && { projectId }),
    },
    include: {
      module: { select: { name: true } },
      _count: { select: { cases: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, type, priority, projectId, moduleId, reference, acceptanceCriteria, notes } = body;

  if (!title || !projectId) return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });

  // ensure demo user exists
  await ensureDemoUser();

  const item = await prisma.item.create({
    data: {
      title, description: description || null, type: type || "USER_STORY",
      priority: priority || "MEDIUM", projectId, moduleId: moduleId || null,
      reference: reference || null, acceptanceCriteria: acceptanceCriteria || null,
      notes: notes || null, authorId: DEMO_USER_ID,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

async function ensureDemoUser() {
  const exists = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (!exists) {
    await prisma.user.create({
      data: { id: DEMO_USER_ID, name: "Demo User", email: "demo@testflow.com" },
    });
  }
}
