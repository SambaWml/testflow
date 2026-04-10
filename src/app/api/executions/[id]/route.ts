import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const execution = await prisma.execution.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.relatedBugRef !== undefined && { relatedBugRef: body.relatedBugRef }),
      ...(body.executedAt && { executedAt: new Date(body.executedAt) }),
    },
  });
  return NextResponse.json({ execution });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.execution.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
