const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Super Admin ────────────────────────────────────────
  const adminPwd = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where:  { email: 'admin@school.edu' },
    update: {},
    create: { name: 'System Administrator', email: 'admin@school.edu', password: adminPwd, role: 'SUPER_ADMIN' },
  });
  console.log(`✅ Super Admin: ${admin.email} / Admin@123`);

  // ── 2. Principal ─────────────────────────────────────────
  const principalPwd = await bcrypt.hash('Principal@123', 12);
  await prisma.user.upsert({
    where:  { email: 'principal@school.edu' },
    update: {},
    create: { name: 'Mrs. Ngozi Adeyemi', email: 'principal@school.edu', password: principalPwd, role: 'PRINCIPAL' },
  });
  console.log('✅ Principal: principal@school.edu / Principal@123');

  // ── 3. Bursary ───────────────────────────────────────────
  const bursaryPwd = await bcrypt.hash('Bursary@123', 12);
  await prisma.user.upsert({
    where:  { email: 'bursary@school.edu' },
    update: {},
    create: { name: 'Mr. Emeka Eze', email: 'bursary@school.edu', password: bursaryPwd, role: 'BURSARY' },
  });
  console.log('✅ Bursary: bursary@school.edu / Bursary@123');

  // ── 4. Classes ───────────────────────────────────────────
  const classData = [
    { name:'JSS1A', level:'JSS', arm:'A', session:'2025/2026' },
    { name:'JSS1B', level:'JSS', arm:'B', session:'2025/2026' },
    { name:'JSS2A', level:'JSS', arm:'A', session:'2025/2026' },
    { name:'JSS2B', level:'JSS', arm:'B', session:'2025/2026' },
    { name:'JSS3A', level:'JSS', arm:'A', session:'2025/2026' },
    { name:'JSS3B', level:'JSS', arm:'B', session:'2025/2026' },
    { name:'SSS1A', level:'SSS', arm:'A', session:'2025/2026' },
    { name:'SSS1B', level:'SSS', arm:'B', session:'2025/2026' },
    { name:'SSS2A', level:'SSS', arm:'A', session:'2025/2026' },
    { name:'SSS2B', level:'SSS', arm:'B', session:'2025/2026' },
    { name:'SSS3A', level:'SSS', arm:'A', session:'2025/2026' },
    { name:'SSS3B', level:'SSS', arm:'B', session:'2025/2026' },
  ];

  for (const cls of classData) {
    await prisma.class.upsert({
      where:  { name: cls.name },
      update: {},
      create: cls,
    });
  }
  console.log(`✅ ${classData.length} classes seeded`);

  // ── 5. Subjects ──────────────────────────────────────────
  // JSS Subjects
  const jssSubjects = [
    { name: 'English Language',              code: 'ENG-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Mathematics',                   code: 'MTH-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Basic Science',                 code: 'BSC-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Basic Technology',              code: 'BTH-JSS',  level: 'JSS', category: 'Core' },
    { name: 'National Values Education',     code: 'NVE-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Business Studies',              code: 'BUS-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Cultural & Creative Arts',      code: 'CCA-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Computer Studies',              code: 'CMP-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Civic Education',               code: 'CIV-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Pre-Vocational Studies',        code: 'PVS-JSS',  level: 'JSS', category: 'Core' },
    { name: 'CRS/IRS',                       code: 'CRS-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Yoruba',                        code: 'YOR-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Agricultural Science',          code: 'AGR-JSS',  level: 'JSS', category: 'Core' },
    { name: 'Home Economics',                code: 'HEC-JSS',  level: 'JSS', category: 'Core' },
  ];

  // SS Subjects
  const ssSubjects = [
    // Core
    { name: 'English Language',              code: 'ENG-SS',   level: 'SS',  category: 'Core' },
    { name: 'Mathematics',                   code: 'MTH-SS',   level: 'SS',  category: 'Core' },
    { name: 'Civic Education',               code: 'CIV-SS',   level: 'SS',  category: 'Core' },
    { name: 'Data Processing',               code: 'DAT-SS',   level: 'SS',  category: 'Core' },
    { name: 'Digital Technology',            code: 'DIT-SS',   level: 'SS',  category: 'Core' },
    { name: 'Fashion Design & Garment Making', code: 'FDG-SS', level: 'SS',  category: 'Core' },
    // Science
    { name: 'Biology',                       code: 'BIO-SS',   level: 'SS',  category: 'Science' },
    { name: 'Chemistry',                     code: 'CHE-SS',   level: 'SS',  category: 'Science' },
    { name: 'Physics',                       code: 'PHY-SS',   level: 'SS',  category: 'Science' },
    { name: 'Further Mathematics',           code: 'FMT-SS',   level: 'SS',  category: 'Science' },
    { name: 'Agricultural Science',          code: 'AGR-SS',   level: 'SS',  category: 'Science' },
    // Commercial
    { name: 'Financial Accounting',          code: 'FAC-SS',   level: 'SS',  category: 'Commercial' },
    { name: 'Commerce',                      code: 'COM-SS',   level: 'SS',  category: 'Commercial' },
    { name: 'Economics',                     code: 'ECO-SS',   level: 'SS',  category: 'Commercial' },
    { name: 'Marketing',                     code: 'MKT-SS',   level: 'SS',  category: 'Commercial' },
    // Arts
    { name: 'Literature in English',         code: 'LIT-SS',   level: 'SS',  category: 'Arts' },
    { name: 'Government',                    code: 'GOV-SS',   level: 'SS',  category: 'Arts' },
    { name: 'History',                       code: 'HIS-SS',   level: 'SS',  category: 'Arts' },
    { name: 'CRS',                           code: 'CRS-SS',   level: 'SS',  category: 'Arts' },
    { name: 'IRS',                           code: 'IRS-SS',   level: 'SS',  category: 'Arts' },
    { name: 'Fine Arts',                     code: 'FNA-SS',   level: 'SS',  category: 'Arts' },
    { name: 'Music',                         code: 'MUS-SS',   level: 'SS',  category: 'Arts' },
  ];

  const allSubjects = [...jssSubjects, ...ssSubjects];
  let seededCount = 0;

  for (const sub of allSubjects) {
    await prisma.subject.upsert({
      where:  { code: sub.code },
      update: { name: sub.name, level: sub.level },
      create: sub,
    });
    seededCount++;
  }
  console.log(`✅ ${seededCount} subjects seeded (${jssSubjects.length} JSS + ${ssSubjects.length} SS)`);

  // ── 6. Academic Session ──────────────────────────────────
  await prisma.academicSession.upsert({
    where:  { name: '2025/2026' },
    update: { isActive: true },
    create: {
      name: '2025/2026', currentTerm: 'FIRST', isActive: true,
      startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'),
    },
  });
  console.log('✅ Academic Session 2025/2026 (active)');

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('─────────────────────────────────────────');
  console.log('Login credentials:');
  console.log('  Admin:     admin@school.edu     / Admin@123');
  console.log('  Principal: principal@school.edu / Principal@123');
  console.log('  Bursary:   bursary@school.edu   / Bursary@123');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
