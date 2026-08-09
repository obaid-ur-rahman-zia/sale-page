import { PrismaClient } from "@prisma/client";
import "dotenv/config";

import { getDatabaseUrl } from "../lib/database-url";

// Fails fast with a readable message; Prisma itself reads DATABASE_URL from the env.
getDatabaseUrl();

const prisma = new PrismaClient();

const IMAGE_PARAMS = "auto=format&fit=crop&w=600&q=70";

const categories = [
  { number: 1, name: "Bags", photoId: "photo-1584917865442-de89df76afd3" },
  { number: 2, name: "Jewelry", photoId: "photo-1617038220319-276d3cfab638" },
  { number: 3, name: "Flags", photoId: "photo-1501514799070-290ae1c889fe" },
  { number: 4, name: "Decorations", photoId: "photo-1531956531700-dc0ee0f1f9a5" },
  { number: 5, name: "Cloth", photoId: "photo-1601056639638-c53c50e13ead" },
  { number: 6, name: "Paint", photoId: "photo-1525909002-1b05e0c869d8" },
  { number: 7, name: "Others", photoId: "photo-1580674287405-80cd77a2fee2" },
].map((category) => ({
  number: category.number,
  name: category.name,
  imageUrl: `https://images.unsplash.com/${category.photoId}?${IMAGE_PARAMS}`,
}));

const salesmen = [{ name: "Ali" }, { name: "Bilal" }, { name: "Usman" }, { name: "Ahmed" }];

async function main() {
  for (const category of categories) {
    // Only the image is refreshed on re-seed: a name edited from the admin page
    // must survive `npm run db:seed`.
    await prisma.category.upsert({
      where: { number: category.number },
      update: { imageUrl: category.imageUrl },
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

  console.log(`Seeded ${categories.length} categories and ${salesmen.length} salesmen.`);
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
