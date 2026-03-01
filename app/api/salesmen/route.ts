import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const salesmen = await prisma.salesman.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({ salesmen });
  } catch (error) {
    console.error("Failed to fetch salesmen:", error);
    return NextResponse.json({ message: "Failed to fetch salesmen" }, { status: 500 });
  }
}
