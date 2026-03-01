import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    number: 1,
    name: "Electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 2,
    name: "Fashion",
    imageUrl:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 3,
    name: "Grocery",
    imageUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 4,
    name: "Books",
    imageUrl:
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 5,
    name: "Home Decor",
    imageUrl:
      "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 6,
    name: "Sports",
    imageUrl:
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 7,
    name: "Beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 8,
    name: "Kids",
    imageUrl:
      "https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 9,
    name: "Accessories",
    imageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
  },
] as const;

const salesmen = [{ name: "Ali" }, { name: "Bilal" }, { name: "Usman" }, { name: "Ahmed" }] as const;

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { number: category.number },
      update: { name: category.name, imageUrl: category.imageUrl },
      create: category,
    });
  }

  for (const salesman of salesmen) {
    await prisma.salesman.upsert({
      where: { name: salesman.name },
      update: {},
      create: salesman,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
