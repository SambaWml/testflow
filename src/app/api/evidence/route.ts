import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const body = await req.json();
  const { executionId, type, fileName, storageKey, linkUrl, description } = body;

  if (!executionId || !type || !fileName) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }

  // Verify execution belongs to user's org
  if (!u.isSuperAdmin) {
    if (!u.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const execution = await prisma.execution.findFirst({
      where: { id: executionId, testPlan: { project: { organizationId: u.orgId } } },
      select: { id: true },
    });
    if (!execution) return NextResponse.json({ error: "Execution não encontrada" }, { status: 404 });
  }

  const evidence = await prisma.evidence.create({
    data: {
      executionId, type, fileName,
      storageKey: storageKey || fileName,
      linkUrl: linkUrl || null,
      publicUrl: linkUrl || null,
      description: description || null,
    },
  });

  return NextResponse.json({ evidence }, { status: 201 });
}
