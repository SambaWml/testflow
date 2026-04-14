import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/permissions";
import { sendWelcomeEmail } from "@/lib/email";
import bcrypt from "bcryptjs";

// GET /api/admin/orgs — list all organizations
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, projects: true } },
      members: {
        where: { role: "OWNER" },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: 1,
      },
    },
  });
  return NextResponse.json({ orgs });
}

// POST /api/admin/orgs — create org + owner user + send credentials
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = sessionUser(session.user);
  if (!u.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { orgName, ownerName, ownerEmail, plan, sendEmail, initialPassword } = body as {
    orgName: string;
    ownerName: string;
    ownerEmail: string;
    plan?: string;
    sendEmail?: boolean;
    initialPassword?: string;
  };

  if (!orgName || !ownerName || !ownerEmail || !plan) {
    return NextResponse.json({ error: "Todos os campos obrigatórios devem ser preenchidos" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(ownerEmail)) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }

  // Build slug from org name
  const slug = orgName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Workspace já existente para esta organização" }, { status: 409 });

  // Use provided password or generate one
  const tempPassword = initialPassword?.trim()
    || Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Check if user already exists
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });

  const result = await prisma.$transaction(async (tx) => {
    // Assign next sequential code starting at 1001
    const last = await tx.organization.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
    const nextCode = (last?.code ?? 1000) + 1;

    const org = await tx.organization.create({
      data: { name: orgName, slug, plan: plan!, code: nextCode },
    });

    if (!owner) {
      owner = await tx.user.create({
        data: { name: ownerName, email: ownerEmail, passwordHash, role: "ADMIN" },
      });
    } else {
      // User already exists — update password so the provided credentials work
      owner = await tx.user.update({
        where: { id: owner.id },
        data: { passwordHash },
      });
    }

    await tx.orgMember.create({
      data: { organizationId: org.id, userId: owner.id, role: "OWNER", joinedAt: new Date() },
    });

    return { org, owner };
  });

  if (sendEmail !== false) {
    try {
      const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
      await sendWelcomeEmail({
        to: ownerEmail,
        name: ownerName,
        orgName,
        email: ownerEmail,
        password: tempPassword,
        loginUrl,
      });
    } catch {
      // Email failure is non-fatal — return credentials in response
      return NextResponse.json({
        org: result.org,
        owner: { id: result.owner!.id, name: result.owner!.name, email: result.owner!.email },
        tempPassword,
        emailSent: false,
        warning: "Organização criada, mas o e-mail não pôde ser enviado. Anote a senha temporária.",
      });
    }
  }

  return NextResponse.json({
    org: result.org,
    owner: { id: result.owner!.id, name: result.owner!.name, email: result.owner!.email },
    emailSent: sendEmail !== false,
    // Always expose tempPassword when not sending email, so admin can note it manually
    ...(sendEmail === false ? { tempPassword } : {}),
  });
}
