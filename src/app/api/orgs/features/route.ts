import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

// GET /api/orgs/features — returns dashboard feature flags for the current org (all roles)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  if (!u.orgId) {
    return NextResponse.json({
      overviewEnabled: true,
      qaDashboardEnabled: true,
      qaDashboardName: "Dashboard QA",
    });
  }

  const org = await prisma.organization.findUnique({
    where: { id: u.orgId },
    select: { overviewEnabled: true, qaDashboardEnabled: true, qaDashboardName: true },
  });

  return NextResponse.json({
    overviewEnabled: org?.overviewEnabled ?? true,
    qaDashboardEnabled: org?.qaDashboardEnabled ?? true,
    qaDashboardName: org?.qaDashboardName ?? "Dashboard QA",
  });
}

// PATCH /api/orgs/features — Owner only, updates dashboard feature flags
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  if (!u.orgId) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (u.orgRole !== "OWNER") {
    return NextResponse.json({ error: "Apenas o Owner pode alterar as funcionalidades" }, { status: 403 });
  }

  const body = await req.json();
  const {
    overviewEnabled,
    qaDashboardEnabled,
    qaDashboardName,
  } = body as {
    overviewEnabled?: boolean;
    qaDashboardEnabled?: boolean;
    qaDashboardName?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof overviewEnabled === "boolean") data.overviewEnabled = overviewEnabled;
  if (typeof qaDashboardEnabled === "boolean") data.qaDashboardEnabled = qaDashboardEnabled;
  if (typeof qaDashboardName === "string" && qaDashboardName.trim()) {
    data.qaDashboardName = qaDashboardName.trim();
  }

  const org = await prisma.organization.update({
    where: { id: u.orgId },
    data,
    select: { overviewEnabled: true, qaDashboardEnabled: true, qaDashboardName: true },
  });

  return NextResponse.json(org);
}
