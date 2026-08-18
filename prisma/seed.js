import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/security.js';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe-Immediately-123!';
  const passwordHash = hashPassword(password);

  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, active: true, role: 'OWNER' },
    create: { email, passwordHash, role: 'OWNER', active: true },
  });

  for (const name of ['Riga', 'Cesis', 'Valmiera']) {
    await prisma.city.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const product of [
    { name: 'Product A', slug: 'product-a', price: 25 },
    { name: 'Product B', slug: 'product-b', price: 40 },
    { name: 'Product C', slug: 'product-c', price: 15 },
  ]) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: { ...product, description: `Example description for ${product.name}.`, active: true },
    });
  }

  await prisma.setting.upsert({
    where: { key: 'affiliatePercent' },
    update: {},
    create: { key: 'affiliatePercent', value: { percent: 5 } },
  });

  console.log(`Seed complete. Admin: ${email}`);
}

main().finally(() => prisma.$disconnect());
