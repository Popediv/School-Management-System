const { getStoredSettings } = require('../modules/settings/settings.controller');

/**
 * Generates the next admission number by scanning ALL existing records
 * with the current prefix and finding the true numeric maximum.
 *
 * MUST be called inside a Prisma transaction (tx) to avoid race conditions.
 * Supports an optional 'offset' parameter for retry loops to skip over broken records.
 *
 * Example output: PCI-2026-0001, PCI-2026-0002, ...
 */
async function generateAdmissionNo(tx, offset = 0) {
  const settings = getStoredSettings();
  const year = new Date().getFullYear();
  const prefix = settings.admissionPrefix || `${process.env.SCHOOL_CODE || 'PCI'}-${year}-`;
  const startingSeq = parseInt(settings.admissionStartingSequence, 10) || 1;

  // Fetch ALL admission numbers with this prefix and find the true numeric max
  const existing = await tx.student.findMany({
    where: { admissionNo: { startsWith: prefix } },
    select: { admissionNo: true },
  });

  let maxNum = startingSeq - 1;
  for (const row of existing) {
    const numStr = row.admissionNo.replace(prefix, '');
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }

  return `${prefix}${String(maxNum + 1 + offset).padStart(4, '0')}`;
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
 * e.g. surname "okonkwo" in lowercase
 */
function generateMoodlePassword(lastName) {
  return lastName.trim().toLowerCase();
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
