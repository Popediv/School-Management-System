/**
 * Generates admission number: GFM-2026-0001
 * Never changes after creation.
 */
async function generateAdmissionNo(prisma) {
  const year   = new Date().getFullYear();
  const prefix = `${process.env.SCHOOL_CODE || 'PCI'}-${year}`;

  const last = await prisma.student.findFirst({
    where:   { admissionNo: { startsWith: prefix } },
    orderBy: { admissionNo: 'desc' },
    select:  { admissionNo: true },
  });

  const nextNum = last
    ? parseInt(last.admissionNo.split('-')[2], 10) + 1
    : 1;

  return `${prefix}-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Generates Moodle username from admission number.
 * GFM-2026-0001 → gfm20260001
 * Never changes after creation.
 */
function generateMoodleUsername(admissionNo) {
  return admissionNo.replace(/-/g, '').toLowerCase();
}

/**
 * Generates a simple default Moodle password.
 * e.g. surname "okonkwo" + birth year "2012" → Okonkwo2012
 */
function generateMoodlePassword(lastName, dateOfBirth) {
  const year = new Date(dateOfBirth).getFullYear();
  const name = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
  return `${name}${year}`;
}

/**
 * Generates a unique receipt number: RCP-20260001
 */
async function generateReceiptNo(prisma) {
  const year = new Date().getFullYear();
  const count = await prisma.payment.count({
    where: { receiptNo: { startsWith: `RCP-${year}` } }
  });
  return `RCP-${year}${String(count + 1).padStart(4, '0')}`;
}

/**
 * Generates teacher staff ID: GFM-TCH-001
 */
async function generateStaffId(prisma) {
  const code = process.env.SCHOOL_CODE || 'PCI';
  const count = await prisma.teacher.count();
  return `${code}-TCH-${String(count + 1).padStart(3, '0')}`;
}

module.exports = {
  generateAdmissionNo,
  generateMoodleUsername,
  generateMoodlePassword,
  generateReceiptNo,
  generateStaffId,
};
