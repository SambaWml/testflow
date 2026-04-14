import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser, getProjectsForUser } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);

  if (u.orgRole !== "OWNER" && u.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const projectId   = searchParams.get("projectId")   ?? undefined;
  const userId      = searchParams.get("userId")       ?? undefined;
  const bugStatus   = searchParams.get("bugStatus")    ?? undefined;
  const bugPriority = searchParams.get("bugPriority")  ?? undefined;
  const period      = parseInt(searchParams.get("period") ?? "30", 10);

  const orgFilter = u.orgId ? { organizationId: u.orgId } : {};

  // OWNER/ADMIN see all org projects (getProjectsForUser returns null); MEMBER sees linked only
  const visibleProjectIdsRaw = u.orgId
    ? await getProjectsForUser(u.id, u.orgId, u.orgRole ?? "MEMBER")
    : [];

  // If null (OWNER/ADMIN), fetch all active org projects
  let visibleProjectIds: string[];
  if (visibleProjectIdsRaw === null) {
    const allOrgProjects = await prisma.project.findMany({
      where: { organizationId: u.orgId!, isActive: true },
      select: { id: true },
    });
    visibleProjectIds = allOrgProjects.map((p) => p.id);
  } else {
    visibleProjectIds = visibleProjectIdsRaw;
  }

  // If a specific project is requested, validate it's in the visible set
  if (projectId) {
    visibleProjectIds = visibleProjectIds.filter((id) => id === projectId);
  }

  // Date range filter
  const since = new Date();
  since.setDate(since.getDate() - period);
  const dateFilter = { gte: since };

  // Project filter (always scoped to visible projects)
  const projFilter = { projectId: { in: visibleProjectIds } };

  // Per-user filters
  const authorFilter  = userId ? { authorId: userId }  : {};
  const creatorFilter = userId ? { creatorId: userId } : {};

  // Bug-specific filters
  const bugStatusFilter   = bugStatus   ? { status: bugStatus }     : {};
  const bugPriorityFilter = bugPriority ? { priority: bugPriority } : {};

  // Bug items (type = BUG)
  const bugWhere = {
    ...orgFilter,
    ...projFilter,
    ...authorFilter,
    ...bugStatusFilter,
    ...bugPriorityFilter,
    type: "BUG",
    createdAt: dateFilter,
  };
  const planWhere   = { ...orgFilter, ...projFilter, ...creatorFilter, createdAt: dateFilter };
  const reportWhere = { ...orgFilter, ...projFilter, ...authorFilter,  generatedAt: dateFilter };

  const [bugCount, planCount, reportCount, bugs, plans, reports] = await Promise.all([
    prisma.item.count({ where: bugWhere }),
    prisma.testPlan.count({ where: planWhere }),
    prisma.report.count({ where: reportWhere }),
    prisma.item.findMany({
      where: bugWhere,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.testPlan.findMany({
      where: planWhere,
      select: {
        id: true,
        name: true,
        status: true,
        result: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        executions: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.report.findMany({
      where: reportWhere,
      select: {
        id: true,
        title: true,
        generatedAt: true,
        metadata: true,
        project: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { generatedAt: "desc" },
      take: 50,
    }),
  ]);

  // Bug distribution by status
  const bugDistribution: Record<string, number> = {};
  bugs.forEach((b) => { bugDistribution[b.status] = (bugDistribution[b.status] ?? 0) + 1; });

  // Bug distribution by priority
  const bugByPriority: Record<string, number> = {};
  bugs.forEach((b) => { bugByPriority[b.priority] = (bugByPriority[b.priority] ?? 0) + 1; });

  // By Project breakdown
  const byProject: Record<string, { name: string; bugs: number; plans: number; reports: number }> = {};
  bugs.forEach((b) => {
    const pid = b.project.id;
    if (!byProject[pid]) byProject[pid] = { name: b.project.name, bugs: 0, plans: 0, reports: 0 };
    byProject[pid].bugs++;
  });
  plans.forEach((p) => {
    const pid = p.project.id;
    if (!byProject[pid]) byProject[pid] = { name: p.project.name, bugs: 0, plans: 0, reports: 0 };
    byProject[pid].plans++;
  });
  reports.forEach((r) => {
    const pid = r.project.id;
    if (!byProject[pid]) byProject[pid] = { name: r.project.name, bugs: 0, plans: 0, reports: 0 };
    byProject[pid].reports++;
  });

  // By QA breakdown
  const byQA: Record<string, { name: string; bugs: number; plans: number; reports: number }> = {};
  bugs.forEach((b) => {
    const uid = b.author.id;
    if (!byQA[uid]) byQA[uid] = { name: b.author.name, bugs: 0, plans: 0, reports: 0 };
    byQA[uid].bugs++;
  });
  plans.forEach((p) => {
    const uid = p.creator.id;
    if (!byQA[uid]) byQA[uid] = { name: p.creator.name, bugs: 0, plans: 0, reports: 0 };
    byQA[uid].plans++;
  });
  reports.forEach((r) => {
    const uid = r.author.id;
    if (!byQA[uid]) byQA[uid] = { name: r.author.name, bugs: 0, plans: 0, reports: 0 };
    byQA[uid].reports++;
  });

  // Plan pass rates
  const plansWithRate = plans.map((plan) => {
    const execs = plan.executions;
    const passed   = execs.filter((e) => e.status === "PASS").length;
    const executed = execs.filter((e) => e.status !== "NOT_EXECUTED" && e.status !== "SKIPPED").length;
    return {
      id: plan.id,
      name: plan.name,
      status: plan.status,
      result: plan.result,
      createdAt: plan.createdAt,
      project: plan.project,
      qa: plan.creator,
      totalCases: execs.length,
      passRate: executed > 0 ? Math.round((passed / executed) * 100) : null,
    };
  });

  // All org members (QA team) for filter dropdown
  const orgMembers = await prisma.orgMember.findMany({
    where: { ...(u.orgId ? { organizationId: u.orgId } : {}), status: "ACTIVE" },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  // Sort by name in JS (avoids relying on relation orderBy)
  orgMembers.sort((a, b) => a.user.name.localeCompare(b.user.name));

  // All visible projects for filter dropdown
  const orgProjects = visibleProjectIds.length > 0
    ? await prisma.project.findMany({
        where: { id: { in: visibleProjectIds }, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return NextResponse.json({
    stats: { bugs: bugCount, plans: planCount, reports: reportCount },
    bugDistribution: Object.entries(bugDistribution).map(([status, count]) => ({ status, count })),
    bugByPriority: Object.entries(bugByPriority).map(([priority, count]) => ({ priority, count })),
    byProject: Object.entries(byProject).map(([id, data]) => ({ id, ...data })),
    byQA: Object.entries(byQA).map(([id, data]) => ({ id, ...data })),
    recentBugs: bugs,
    recentPlans: plansWithRate,
    recentReports: reports,
    members: orgMembers.map((m) => m.user),
    projects: orgProjects,
  });
}
