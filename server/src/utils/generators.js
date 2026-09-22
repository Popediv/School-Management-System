const { getStoredSettings } = require('../modules/settings/settings.controller');

/**
 * Generates the next admission number by scanning existing records.
 * Uses a collision-checker loop to definitively ensure neither the admissionNo 
 * nor the moodleUsername will conflict, bypassing any manual or legacy corrupted records.
 *
 * MUST be called inside a Prisma transaction (tx) to avoid race conditions.
 *
 * Example output: PCI-2026-0001, PCI-2026-0002, ...
 */
async function generateAdmissionNo(tx, offset = 0) {
  const settings = getStoredSettings();
  const year = new Date().getFullYear();
  const prefix = settings.admissionPrefix || `${process.env.SCHOOL_CODE || 'PCI'}-${year}-`;
  const startingSeq = parseInt(settings.admissionStartingSequence, 10) || 1;

  // 1. Find the highest numeric value currently in use for this prefix
  const existingRecords = await tx.student.findMany({
    where: { admissionNo: { startsWith: prefix } },
    select: { admissionNo: true },
  });

  let maxNum = startingSeq - 1;
  for (const row of existingRecords) {
    const numStr = row.admissionNo.replace(prefix, '');
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }

  // 2. Loop until we find a combination that has absolutely ZERO collisions on ANY field
  let currentNum = maxNum + 1 + offset;

  while (true) {
    const trialAdmissionNo = `${prefix}${String(currentNum).padStart(4, '0')}`;
    const trialMoodle = trialAdmissionNo.replace(/-/g, '').toLowerCase();

    // Check if either field happens to be taken by an orphaned/manual record
    const conflict = await tx.student.findFirst({
      where: {
        OR: [
          { admissionNo: trialAdmissionNo },
          { moodleUsername: trialMoodle }
        ]
      }
    });

    if (!conflict) {
      return trialAdmissionNo;
    }

    // If conflict exists silently bump the number and check the next one
    currentNum++;
  }
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
