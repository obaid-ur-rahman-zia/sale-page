import { NextResponse } from "next/server";

import { validateCategoryInput } from "@/lib/category-input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // The sale screen only ever wants sellable categories; the admin screen asks
    // for everything so retired ones can still be edited or re-enabled.
    const includeInactive = searchParams.get("includeInactive") === "1";

    const categories = await prisma.category.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        name: true,
        imageUrl: true,
        isActive: true,
        _count: { select: { sales: true } },
      },
    });

    return NextResponse.json({
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        salesCount: _count.sales,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ message: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = validateCategoryInput(body);

    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.message }, { status: 400 });
    }

    const { name, imageUrl, number, isActive } = parsed.value;

    let resolvedNumber = number;
    if (resolvedNumber === undefined) {
      const highest = await prisma.category.findFirst({
        orderBy: { number: "desc" },
        select: { number: true },
      });
      resolvedNumber = (highest?.number ?? 0) + 1;
    }

    const duplicate = await prisma.category.findUnique({
      where: { number: resolvedNumber },
      select: { id: true, name: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { message: `Category number ${resolvedNumber} is already used by "${duplicate.name}"` },
        { status: 409 },
      );
    }

    const category = await prisma.category.create({
      data: { name, imageUrl, number: resolvedNumber, isActive: isActive ?? true },
      select: { id: true, number: true, name: true, imageUrl: true, isActive: true },
    });

    return NextResponse.json({ category: { ...category, salesCount: 0 } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json({ message: "Failed to create category" }, { status: 500 });
  }
}
