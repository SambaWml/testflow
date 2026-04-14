import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const org = await prisma.organization.findUnique({
    where: { id: u.orgId },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      plan: true,
      isActive: true,
      createdAt: true,
      _count: { select: { members: true, projects: true } },
    },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ org });
}
