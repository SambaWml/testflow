import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";

// Notifications are derived from existing data — no separate notifications table needed.
// The bell badge polls this endpoint every 60s (see topbar.tsx).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  // Users without an org (edge case during onboarding) get an empty list, not an error.
  if (!u.orgId && !u.isSuperAdmin) return NextResponse.json({ notifications: [], total: 0 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // Super admins see cross-org data; regular users see only their own org.
  const orgFilter = u.orgId && !u.isSuperAdmin ? { organizationId: u.orgId } : {};

  // Run all three counts in parallel — each is an O(index) aggregate, not a full table scan.
  const [failCount, pendingCount, newMembersCount] = await Promise.all([
    // Failures from the last 7 days only — older failures are stale/already actioned.
    prisma.execution.count({
      where: { ...orgFilter, status: "FAIL", updatedAt: { gte: sevenDaysAgo } },
    }),
    // Pending = NOT_EXECUTED across all active plans — no time window, these never expire on their own.
    prisma.execution.count({
      where: { ...orgFilter, status: "NOT_EXECUTED" },
    }),
    // New members within 7 days; only meaningful for org-scoped users.
    u.orgId
      ? prisma.orgMember.count({
          where: { organizationId: u.orgId, invitedAt: { gte: sevenDaysAgo } },
        })
      : Promise.resolve(0),
  ]);

  const notifications: {
    id: string;
    type: "error" | "warning" | "info";
    title: string;
    body: string;
    href: string;
  }[] = [];

  if (failCount > 0) {
    notifications.push({
      id: "fail-executions",
      type: "error",
      title: `${failCount} execução${failCount > 1 ? "ões" : ""} com falha`,
      body: "Nos últimos 7 dias",
      href: "/executions",
    });
  }

  if (pendingCount > 0) {
    notifications.push({
      id: "pending-executions",
      type: "warning",
      title: `${pendingCount} execução${pendingCount > 1 ? "ões" : ""} pendente${pendingCount > 1 ? "s" : ""}`,
      body: "Aguardando execução nos planos ativos",
      href: "/executions",
    });
  }

  // Threshold > 1 because the org owner's own membership is always counted in the window.
  if (newMembersCount > 1) {
    notifications.push({
      id: "new-members",
      type: "info",
      title: `${newMembersCount} novo${newMembersCount > 1 ? "s" : ""} membro${newMembersCount > 1 ? "s" : ""}`,
      body: "Adicionados nos últimos 7 dias",
      href: "/settings/members",
    });
  }

  return NextResponse.json({ notifications, total: notifications.length });
}
