import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: { module: true, project: true, _count: { select: { cases: true } } },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { title, description, type, priority, status, projectId, moduleId, reference, acceptanceCriteria, notes } = body;

  const item = await prisma.item.update({
    where: { id },
    data: {
      ...(title && { title }),
      description: description ?? undefined,
      ...(type && { type }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(projectId && { projectId }),
      moduleId: moduleId || null,
      reference: reference || null,
      acceptanceCriteria: acceptanceCriteria || null,
      notes: notes || null,
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
