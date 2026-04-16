"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider } from "@/contexts/lang-context";
import { TermsProvider } from "@/contexts/terms-context";
import { ThemeProvider } from "@/contexts/theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
      })
  );

  return (
    <SessionProvider>
      <ThemeProvider>
        <LangProvider>
          <TermsProvider>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider delayDuration={300}>
                {children}
              </TooltipProvider>
            </QueryClientProvider>
          </TermsProvider>
        </LangProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
