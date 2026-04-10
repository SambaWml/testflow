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
