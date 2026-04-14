"use client";

import { FlaskConical, Clock } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mx-auto mb-4">
          <FlaskConical className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Acesso pendente</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Sua conta foi criada, mas você ainda não foi adicionado a nenhuma organização.
          Entre em contato com o administrador do sistema.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
          <Clock className="h-4 w-4" />
          Aguardando aprovação
        </div>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sair
        </Button>
      </div>
    </div>
  );
}
