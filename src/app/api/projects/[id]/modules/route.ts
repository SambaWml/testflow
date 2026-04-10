import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const modules = await prisma.module.findMany({
    where: { projectId: id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ modules });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, description } = await req.json();
  const module = await prisma.module.create({
    data: { name, description: description || null, projectId: id },
  });
  return NextResponse.json({ module }, { status: 201 });
}
