import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sessionUser } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  const { id } = await params;
  const modules = await prisma.module.findMany({
    where: {
      projectId: id,
      // Super admins see all; regular users scoped to their org via the project relation
      project: u.isSuperAdmin ? undefined : { organizationId: u.orgId ?? undefined },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ modules });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, description } = await req.json();

  // `module` is a reserved Node.js global — use `newModule` instead
  const newModule = await prisma.module.create({
    data: { name, description: description || null, projectId: id },
  });
  return NextResponse.json({ module: newModule }, { status: 201 });
}
