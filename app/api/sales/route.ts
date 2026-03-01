import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type CreateSalePayload = {
  saleId?: string;
  categoryId?: number;
  amount?: number;
  items?: Array<{
    categoryId?: number;
    amount?: number;
  }>;
};

function generateSaleId() {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const stamp = now.getTime().toString().slice(-6);

  return `SAL-${date}-${stamp}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateSalePayload;
    const saleId = body.saleId?.trim() || generateSaleId();
    const items =
      body.items?.map((item) => ({
        categoryId: Number(item.categoryId),
        amount: Number(item.amount),
      })) ?? [];

    if (items.length === 0) {
      const categoryId = Number(body.categoryId);
      const amount = Number(body.amount);
      if (Number.isFinite(categoryId) && Number.isFinite(amount)) {
        items.push({ categoryId, amount });
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ message: "At least one sale item is required" }, { status: 400 });
    }

    const hasInvalidItem = items.some(
      (item) =>
        !Number.isFinite(item.categoryId) ||
        item.categoryId <= 0 ||
        !Number.isFinite(item.amount) ||
        item.amount <= 0,
    );

    if (hasInvalidItem) {
      return NextResponse.json({ message: "All items must have valid categoryId and amount" }, { status: 400 });
    }

    const categoryIds = [...new Set(items.map((item) => item.categoryId))];
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    const existingCategoryIds = new Set(categories.map((category) => category.id));
    const missingCategoryId = categoryIds.find((id) => !existingCategoryIds.has(id));

    if (missingCategoryId) {
      return NextResponse.json(
        { message: `Category not found for id ${missingCategoryId}` },
        { status: 404 },
      );
    }

    const createdSales = await prisma.$transaction(
      items.map((item) =>
        prisma.sale.create({
          data: {
            saleId,
            categoryId: item.categoryId,
            amount: item.amount,
          },
          select: {
            id: true,
            saleId: true,
            amount: true,
            categoryId: true,
            createdAt: true,
          },
        }),
      ),
    );

    return NextResponse.json(
      {
        saleId,
        itemsCreated: createdSales.length,
        sales: createdSales,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create sale:", error);
    return NextResponse.json({ message: "Failed to create sale" }, { status: 500 });
  }
}
