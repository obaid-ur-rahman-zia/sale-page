import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        name: true,
        imageUrl: true,
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ message: "Failed to fetch categories" }, { status: 500 });
  }
}
