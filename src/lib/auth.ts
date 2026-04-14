import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: {
              orgMembers: { include: { organization: { select: { id: true, slug: true, name: true } } } },
            },
          });
        } catch (e) {
          console.error("[auth] erro ao buscar usuário:", e);
          return null;
        }
        console.log("[auth] usuário encontrado:", user?.email ?? "nenhum");
        if (!user || !user.passwordHash) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        console.log("[auth] senha válida:", valid);
        if (!valid) return null;

        // Pick the first active org membership (or null for super admins with no org)
        const firstMember = user.orgMembers[0] ?? null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
          orgId: firstMember?.organizationId ?? null,
          orgRole: firstMember?.role ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.role = (user as { role?: string }).role ?? "TESTER";
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;
        token.orgId = (user as { orgId?: string | null }).orgId ?? null;
        token.orgRole = (user as { orgRole?: string | null }).orgRole ?? null;
      }
      if (trigger === "update" && session?.name) {
        token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).isSuperAdmin = token.isSuperAdmin;
        (session.user as unknown as Record<string, unknown>).orgId = token.orgId;
        (session.user as unknown as Record<string, unknown>).orgRole = token.orgRole;
      }
      return session;
    },
  },
});
