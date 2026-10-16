const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'stdout', level: 'query' }, { emit: 'stdout', level: 'error' }]
    : [{ emit: 'stdout', level: 'error' }],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Log slow queries in production (> 1000ms) to catch regressions early
if (process.env.NODE_ENV !== 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > 1000) {
      console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query}`);
    }
  });
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
