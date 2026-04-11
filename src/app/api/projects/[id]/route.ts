import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const count = await prisma.item.count({ where: { projectId: id } });
  if (count > 0) {
    return NextResponse.json({ error: "has_items", count }, { status: 409 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Toggle isActive
  if (typeof body.isActive === "boolean") {
    const isActive = body.isActive;

    // Update project + cascade to test cases
    const [project] = await prisma.$transaction([
      prisma.project.update({ where: { id }, data: { isActive } }),
      prisma.testCase.updateMany({ where: { projectId: id }, data: { isActive } }),
    ]);

    return NextResponse.json({ project });
  }

  // Generic update (name, description)
  const project = await prisma.project.update({ where: { id }, data: body });
  return NextResponse.json({ project });
}
