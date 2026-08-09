import { NextResponse } from "next/server";

import { validateCategoryInput } from "@/lib/category-input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveId(context: RouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (id === null) {
      return NextResponse.json({ message: "Invalid category id" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = validateCategoryInput(body, { partial: true });
    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.message }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      select: { id: true, number: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "Category not found" }, { status: 404 });
    }

    const { name, imageUrl, number, isActive } = parsed.value;

    if (number !== undefined && number !== existing.number) {
      const duplicate = await prisma.category.findUnique({
        where: { number },
        select: { name: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: `Category number ${number} is already used by "${duplicate.name}"` },
          { status: 409 },
        );
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(number !== undefined ? { number } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id: true,
        number: true,
        name: true,
        imageUrl: true,
        isActive: true,
        _count: { select: { sales: true } },
      },
    });

    const { _count, ...rest } = category;
    return NextResponse.json({ category: { ...rest, salesCount: _count.sales } });
  } catch (error) {
    console.error("Failed to update category:", error);
    return NextResponse.json({ message: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = await resolveId(context);
    if (id === null) {
      return NextResponse.json({ message: "Invalid category id" }, { status: 400 });
    }

    const category = await prisma.category.findUnique({
      where: { id },
      select: { name: true, _count: { select: { sales: true } } },
    });

    if (!category) {
      return NextResponse.json({ message: "Category not found" }, { status: 404 });
    }

    // Deleting would orphan historical reports, so a category that has ever sold
    // something can only be deactivated.
    if (category._count.sales > 0) {
      return NextResponse.json(
        {
          message: `"${category.name}" has ${category._count.sales} sale record(s) and cannot be deleted. Mark it inactive instead.`,
        },
        { status: 409 },
      );
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Failed to delete category:", error);
    return NextResponse.json({ message: "Failed to delete category" }, { status: 500 });
  }
}
