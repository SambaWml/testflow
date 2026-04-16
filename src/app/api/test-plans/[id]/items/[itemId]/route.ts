import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; itemId: string }> };

// DELETE — remove a case from a test plan (also removes its execution result if any)
export async function DELETE(_: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: planId, itemId } = await params;

    const item = await prisma.testPlanCase.findFirst({
      where: { id: itemId, testPlanId: planId },
    });
    if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

    // Remove any existing execution result for this case in this plan
    await prisma.execution.deleteMany({
      where: { testPlanId: planId, caseId: item.caseId },
    });

    await prisma.testPlanCase.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/test-plans/[id]/items/[itemId]]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
