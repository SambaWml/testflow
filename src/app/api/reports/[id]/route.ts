import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      author: { select: { name: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          execution: {
            include: {
              case: {
                select: {
                  title: true, format: true, precondition: true,
                  bddGiven: true, bddWhen: true, bddThen: true,
                  expectedResult: true, priority: true,
                  steps: { orderBy: { order: "asc" } },
                },
              },
              executor: { select: { name: true } },
              evidence: true,
            },
          },
        },
      },
    },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.report.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
