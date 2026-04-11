import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USER_ID = "demo-user-id";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "";
    const projectId = searchParams.get("projectId") ?? "";

    const plans = await prisma.testPlan.findMany({
      where: {
        project: { isActive: true },
        ...(status && { status }),
        ...(projectId && { projectId }),
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true } },
        items: {
          include: { case: { select: { id: true, title: true, format: true, priority: true } } },
          orderBy: { order: "asc" },
        },
        executions: {
          include: { case: { select: { id: true, title: true, format: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ plans });
  } catch (err) {
    console.error("[GET /api/test-plans]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, projectId, environment, buildVersion, notes, caseIds } = body;

    if (!name || !projectId) {
      return NextResponse.json({ error: "Nome e projeto são obrigatórios" }, { status: 400 });
    }

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um caso de teste" }, { status: 400 });
    }

    await ensureDemoUser();

    const plan = await prisma.testPlan.create({
      data: {
        name,
        projectId,
        creatorId: DEMO_USER_ID,
        environment: environment || "",
        buildVersion: buildVersion || null,
        notes: notes || null,
        items: {
          create: (caseIds as string[]).map((caseId, i) => ({
            caseId,
            order: i + 1,
          })),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { name: true } },
        items: {
          include: { case: { select: { id: true, title: true, format: true, priority: true } } },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/test-plans]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function ensureDemoUser() {
  const exists = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  if (!exists) {
    await prisma.user.create({
      data: { id: DEMO_USER_ID, name: "Demo User", email: "demo@testflow.com" },
    });
  }
}
