import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true, cases: true, testPlans: true, executions: true, reports: true } } },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  let slug = slugify(name);
  // ensure unique slug
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const project = await prisma.project.create({
    data: { name, description: description || null, slug },
  });
  return NextResponse.json({ project }, { status: 201 });
}
