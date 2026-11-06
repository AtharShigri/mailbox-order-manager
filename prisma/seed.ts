import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const DEMO_CREDENTIALS = [
  {
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'Password123!',
    role: UserRole.ADMIN,
  },
  {
    email: 'customer1@example.com',
    name: 'Acme Corp (Customer 1)',
    password: 'Password123!',
    role: UserRole.CUSTOMER,
  },
  {
    email: 'customer2@example.com',
    name: 'Stark Industries (Customer 2)',
    password: 'Password123!',
    role: UserRole.CUSTOMER,
  },
];

async function main() {
  console.log('🌱 Starting database seeding...');

  for (const user of DEMO_CREDENTIALS) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    const seededUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
      },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
      },
    });

    console.log(`✓ Seeded user: ${seededUser.email} [${seededUser.role}] (id: ${seededUser.id})`);
  }

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

