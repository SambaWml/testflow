import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes — always accessible
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/uploads") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  // Not authenticated
  if (!session?.user) {
    // API routes → 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages → redirect to login
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in → don't show login page
  if (pathname === "/login") {
    const user = session.user as { isSuperAdmin?: boolean };
    const dest = user.isSuperAdmin ? "/admin" : "/";
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  const user = session.user as {
    isSuperAdmin?: boolean;
    orgId?: string | null;
    orgRole?: string | null;
  };

  // Settings pages → Owner can do everything, Admin can view, Member/Viewer blocked
  const isSettingsMembersOrProjects =
    pathname.startsWith("/settings/members") || pathname.startsWith("/settings/projects");
  if (isSettingsMembersOrProjects) {
    const role = (user as { orgRole?: string | null }).orgRole;
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
  }

  // /admin routes → Super Admin only
  if (pathname.startsWith("/admin")) {
    if (!user.isSuperAdmin) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  // Super Admin Geral → atua apenas no painel global, não no dashboard das orgs
  if (user.isSuperAdmin && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  // Users without an org go to /pending
  if (!user.isSuperAdmin && !user.orgId && !pathname.startsWith("/pending")) {
    return NextResponse.redirect(new URL("/pending", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
