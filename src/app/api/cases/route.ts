import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-id";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const format = searchParams.get("format") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const limit = Number(searchParams.get("limit") ?? "50");

  const cases = await prisma.testCase.findMany({
    where: {
      isActive: true,
      project: { isActive: true },
      ...(q && { OR: [{ title: { contains: q } }, { bddGiven: { contains: q } }] }),
      ...(format && { format }),
      ...(projectId && { projectId }),
    },
    include: {
      steps: { orderBy: { order: "asc" } },
      item: { select: { title: true } },
      module: { select: { name: true } },
      project: { select: { id: true, name: true } },
      executions: { select: { status: true, executedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, format, priority, projectId, itemId, moduleId, precondition, notes,
          bddGiven, bddWhen, bddThen, expectedResult, steps } = body;

  if (!title || !projectId) {
    return NextResponse.json({ error: "title and projectId are required" }, { status: 400 });
  }

  await ensureDemoUser();

  const tc = await prisma.testCase.create({
    data: {
      title,
      format: format ?? "BDD",
      priority: priority ?? "MEDIUM",
      projectId,
      itemId: itemId || null,
      moduleId: moduleId || null,
      authorId: DEMO_USER_ID,
      precondition: precondition || null,
      notes: notes || null,
      bddGiven: bddGiven || null,
      bddWhen: bddWhen || null,
      bddThen: bddThen || null,
      expectedResult: expectedResult || null,
      ...(Array.isArray(steps) && steps.length > 0 && {
        steps: {
          create: steps
            .filter((s: { description: string }) => s.description?.trim())
            .map((s: { description: string; expectedData?: string }, i: number) => ({
              order: i + 1,
              description: s.description,
              expectedData: s.expectedData || null,
            })),
        },
      }),
    },
  });

  return NextResponse.json({ tc }, { status: 201 });
}

async function ensureDemoUser() {
  const exists = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (!exists) {
    await prisma.user.create({
      data: { id: DEMO_USER_ID, name: "Demo User", email: "demo@testflow.com" },
    });
  }
}
