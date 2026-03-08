import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrl =
  !configuredDatabaseUrl || configuredDatabaseUrl === "file:./dev.db"
    ? "file:./prisma/dev.db"
    : configuredDatabaseUrl;
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    number: 1,
    name: "Jewelry",
    imageUrl:
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 2,
    name: "Jhumki",
    imageUrl:
      "https://images.unsplash.com/photo-1611085583191-a3b181a88401?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 3,
    name: "Bangles",
    imageUrl:
      "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 4,
    name: "Bangle Set",
    imageUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 5,
    name: "Accessories",
    imageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 6,
    name: "Makeup",
    imageUrl:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 7,
    name: "Glasses",
    imageUrl:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 8,
    name: "Mehndi",
    imageUrl:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80",
  },
  {
    number: 9,
    name: "Watches",
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
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
