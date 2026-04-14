import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

type BugInput = {
  title: string;
  description?: string;
  priority?: string;
  acceptanceCriteria?: string;
  notes?: string;
  reference?: string;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const body = await req.json();
  const { bugs, projectId } = body as { bugs: BugInput[]; projectId: string };

  if (!bugs?.length || !projectId) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });

  const created = await prisma.$transaction(
    bugs.map((b) =>
      prisma.item.create({
        data: {
          title: b.title,
          description: b.description || null,
          type: "BUG",
          priority: b.priority || "MEDIUM",
          status: "OPEN",
          projectId,
          reference: b.reference || null,
          acceptanceCriteria: b.acceptanceCriteria || null,
          notes: b.notes || null,
          authorId: u.id,
          organizationId: project?.organizationId ?? u.orgId ?? null,
        },
      })
    )
  );

  return NextResponse.json({ created, count: created.length }, { status: 201 });
}
