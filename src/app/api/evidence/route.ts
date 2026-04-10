import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { executionId, type, fileName, storageKey, linkUrl, description } = body;

  if (!executionId || !type || !fileName) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }

  const evidence = await prisma.evidence.create({
    data: {
      executionId, type, fileName,
      storageKey: storageKey || fileName,
      linkUrl: linkUrl || null,
      publicUrl: linkUrl || null,
      description: description || null,
    },
  });

  return NextResponse.json({ evidence }, { status: 201 });
}
