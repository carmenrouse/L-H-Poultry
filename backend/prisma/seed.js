const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const business = await prisma.business.create({
    data: {
      name: 'L&H Poultry',
      taxRate: 0.0725,
      allowNegativeStock: false,
      users: {
        create: [
          { email: 'owner@lhpoultry.test', name: 'Lena Hart', passwordHash, role: 'OWNER' },
          { email: 'manager@lhpoultry.test', name: 'Marcus Diaz', passwordHash, role: 'MANAGER' },
          { email: 'cashier@lhpoultry.test', name: 'Casey Nguyen', passwordHash, role: 'CASHIER' },
        ],
      },
    },
    include: { users: true },
  });

  const owner = business.users.find((u) => u.role === 'OWNER');

  const supplier = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Coastal Feed & Farm Supply',
      contactName: 'Dana Reyes',
      email: 'orders@coastalfeed.test',
      phone: '555-010-2200',
      address: '412 Harbor Rd, Salinas, CA',
    },
  });

  const productsData = [
    { sku: 'EGG-DZ-LG', name: 'Large Eggs (Dozen)', category: 'Eggs', cost: 2.1, price: 4.5, quantityOnHand: 120, reorderPoint: 24, barcode: '049000028911' },
    { sku: 'CHKN-WH-3LB', name: 'Whole Chicken (~3lb)', category: 'Poultry', cost: 4.75, price: 9.99, quantityOnHand: 40, reorderPoint: 10, barcode: '049000028928' },
    { sku: 'CHKN-BRST-1LB', name: 'Chicken Breast (1lb)', category: 'Poultry', cost: 3.1, price: 6.49, quantityOnHand: 60, reorderPoint: 15, barcode: '049000028935' },
    { sku: 'FEED-LAY-40', name: 'Layer Feed 40lb Bag', category: 'Feed', cost: 12.0, price: 21.99, quantityOnHand: 25, reorderPoint: 5, barcode: '049000028942' },
    { sku: 'DUCK-EGG-6', name: 'Duck Eggs (6-pack)', category: 'Eggs', cost: 3.5, price: 7.0, quantityOnHand: 18, reorderPoint: 6, barcode: '049000028959' },
  ];

  const products = [];
  for (const p of productsData) {
    products.push(await prisma.product.create({ data: { businessId: business.id, ...p } }));
  }

  const feedProduct = products.find((p) => p.sku === 'FEED-LAY-40');
  const eggProduct = products.find((p) => p.sku === 'EGG-DZ-LG');

  await prisma.purchaseOrder.create({
    data: {
      businessId: business.id,
      supplierId: supplier.id,
      status: 'SUBMITTED',
      source: 'MANUAL',
      poNumber: 'PO-1001',
      createdById: owner.id,
      submittedAt: new Date(),
      lineItems: {
        create: [
          { productId: feedProduct.id, quantityOrdered: 20, unitCost: 12.0 },
          { productId: eggProduct.id, quantityOrdered: 50, unitCost: 2.1 },
        ],
      },
    },
  });

  console.log('Seed complete.');
  console.log('Login with: owner@lhpoultry.test / manager@lhpoultry.test / cashier@lhpoultry.test, password: password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
