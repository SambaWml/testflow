import { prisma } from "@/lib/prisma";

/**
 * Returns the list of projectIds that a user can see.
 * - Super admins see all projects in the org.
 * - Org OWNER / ADMIN see all org projects.
 * - MEMBER / VIEWER see only projects they're explicitly added to.
 */
export async function getProjectsForUser(
  userId: string,
  organizationId: string,
  orgRole: string
): Promise<string[] | null> {
  // OWNER and ADMIN see everything — return null to signal "no filter"
  if (orgRole === "OWNER" || orgRole === "ADMIN") return null;

  // MEMBER / VIEWER — only projects they're explicitly added to
  const memberships = await prisma.projectMember.findMany({
    where: { userId, project: { organizationId } },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

/**
 * Returns the project IDs that a user is explicitly linked to,
 * regardless of their org role. Used for data visibility filtering
 * in dashboard contexts where everyone sees only their linked projects.
 */
export async function getLinkedProjects(userId: string, orgId: string): Promise<string[]> {
  const memberships = await prisma.projectMember.findMany({
    where: { userId, project: { organizationId: orgId } },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

/**
 * Lightweight session type helpers used across API routes.
 */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  orgId: string | null;
  orgRole: string | null;
};

export function sessionUser(user: unknown): SessionUser {
  const u = user as Record<string, unknown>;
  return {
    id: u.id as string,
    name: u.name as string,
    email: u.email as string,
    role: (u.role as string) ?? "TESTER",
    isSuperAdmin: (u.isSuperAdmin as boolean) ?? false,
    orgId: (u.orgId as string | null) ?? null,
    orgRole: (u.orgRole as string | null) ?? null,
  };
}
