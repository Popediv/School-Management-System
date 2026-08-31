const prisma = require('../../config/db');
const { generateReceiptNo } = require('../../utils/generators');

const getStudentFees = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const payments = await prisma.payment.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    const totalPaid = payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
    const outstanding = payments.reduce((s, p) => s + (p.amount - (p.amountPaid || 0)), 0);
    res.json({ payments, summary: { totalPaid, outstanding, count: payments.length } });
  } catch (err) { next(err); }
};

const getLedger = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { currentClass: true, user: true }
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Ensure we capture all known transactions for this student
    const invoices = await prisma.payment.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
    });

    const ledger = [];

    invoices.forEach(inv => {
      // 1. Debit entry (Invoice created)
      ledger.push({
        id: `INV-${inv.id}`,
        date: inv.createdAt.toISOString(),
        reference: inv.receiptNo,
        description: `Invoice: ${inv.description} - ${inv.session} (${inv.term})`,
        debit: inv.amount,
        credit: 0,
        status: inv.status,
      });

      // 2. Credit entry (Amount paid)
      if (inv.amountPaid > 0) {
        ledger.push({
          id: `PAY-${inv.id}`,
          date: inv.paidAt ? inv.paidAt.toISOString() : inv.createdAt.toISOString(),
          reference: inv.reference || inv.receiptNo,
          description: `Payment: ${inv.description}${inv.paymentMethod ? ' via ' + inv.paymentMethod : ''}`,
          debit: 0,
          credit: inv.amountPaid,
          status: '—',
        });
      }
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    ledger.forEach(entry => {
      // Assuming a Debit means school is charging the student, so balance increases for the student in terms of "owe"
      // Wait, standard accounting: Debit (Charge to A/R) increases amount owed. Credit (Payment to A/R) decreases amount owed.
      runningBalance += entry.debit;
      runningBalance -= entry.credit;
      entry.balance = runningBalance;
    });

    res.json({ student, ledger, currentBalance: runningBalance });
  } catch (err) { next(err); }
};

const getGlobalLedger = async (req, res, next) => {
  try {
    const { session, term } = req.query;
    const where = { amountPaid: { gt: 0 } };
    if (session) where.session = session;
    if (term) where.term = term;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            admissionNo: true,
            currentClass: { select: { name: true } }
          }
        }
      }
    });

    const stats = { totalCollected: 0, byCategory: {} };
    payments.forEach(p => {
      stats.totalCollected += (p.amountPaid || 0);
      const cat = p.description || 'Other';
      if (!stats.byCategory[cat]) stats.byCategory[cat] = 0;
      stats.byCategory[cat] += (p.amountPaid || 0);
    });

    res.json({ payments, stats });
  } catch (err) { next(err); }
};

const createInvoice = async (req, res, next) => {
  try {
    const { studentId, amount, description, session, term } = req.body;
    if (!studentId || !amount || !description || !session || !term)
      return res.status(400).json({ message: 'studentId, amount, description, session, term required' });

    const receiptNo = await generateReceiptNo(prisma);
    const payment = await prisma.payment.create({
      data: { studentId, amount: parseFloat(amount), description, session, term, receiptNo, status: 'PENDING' },
    });
    res.status(201).json({ message: 'Invoice created', payment });
  } catch (err) { next(err); }
};

const recordPayment = async (req, res, next) => {
  try {
    const { paymentId, amountPaid, paymentMethod, reference } = req.body;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ message: 'Invoice not found' });

    const totalPaidNow = (payment.amountPaid || 0) + parseFloat(amountPaid);
    const newStatus = totalPaidNow >= payment.amount ? 'PAID' : 'PARTIAL';
    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        amountPaid: totalPaidNow,
        paymentMethod: paymentMethod || payment.paymentMethod,
        reference: reference || payment.reference,
        paidAt: new Date(),
        recordedBy: req.user.id
      },
    });
    res.json({ message: 'Payment recorded', payment: updated });
  } catch (err) { next(err); }
};

const getReceipt = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true, currentClass: true } } },
    });
    if (!payment) return res.status(404).json({ message: 'Receipt not found' });
    res.json({ receipt: payment });
  } catch (err) { next(err); }
};

const getOutstanding = async (req, res, next) => {
  try {
    const allPayments = await prisma.payment.findMany({
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true, currentClass: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    let totalOutstanding = 0;
    const studentIdsWithBalance = new Set();
    let fullyPaid = 0;
    let partialPaid = 0;

    const outstanding = [];

    allPayments.forEach(p => {
      if (p.status === 'PAID') {
        fullyPaid++;
      } else {
        totalOutstanding += (p.amount - (p.amountPaid || 0));
        studentIdsWithBalance.add(p.studentId);
        if (p.status === 'PARTIAL') partialPaid++;

        outstanding.push({
          id: p.id,
          studentName: `${p.student.lastName} ${p.student.firstName}`,
          admissionNo: p.student.admissionNo,
          class: p.student.currentClass?.name || '—',
          amount: p.amount,
          balance: p.amount - (p.amountPaid || 0),
          type: p.description,
          dueDate: p.createdAt.toISOString().split('T')[0], // Using createdAt as dueDate for now
          status: p.status === 'PENDING' ? 'UNPAID' : p.status,
        });
      }
    });

    res.json({
      summary: {
        totalOutstanding,
        totalStudents: studentIdsWithBalance.size,
        fullyPaid,
        partialPaid,
      },
      outstanding
    });
  } catch (err) { next(err); }
};

const getFeeStructures = async (req, res, next) => {
  try {
    const structures = await prisma.feeStructure.findMany({
      include: { class: { select: { name: true } } },
      orderBy: [{ session: 'desc' }, { term: 'asc' }],
    });
    res.json(structures);
  } catch (err) { next(err); }
};

const createFeeStructure = async (req, res, next) => {
  try {
    const { classId, description, amount, session, term, category, isOneTime, sortOrder } = req.body;
    if (!classId || !description || !amount || !session || !term) {
      return res.status(400).json({ message: 'classId, description, amount, session, term are required' });
    }

    const structure = await prisma.feeStructure.upsert({
      where: {
        classId_description_session_term: {
          classId,
          description,
          session,
          term
        }
      },
      update: {
        amount: parseFloat(amount),
        category: category || undefined,
        isOneTime: isOneTime !== undefined ? !!isOneTime : undefined,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : undefined,
      },
      create: {
        classId,
        description,
        amount: parseFloat(amount),
        session,
        term,
        category: category || null,
        isOneTime: !!isOneTime,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : 0,
      }
    });

    res.status(201).json({ message: 'Fee structure configured successfully', structure });
  } catch (err) { next(err); }
};

const deleteFeeStructure = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.feeStructure.delete({ where: { id } });
    res.json({ message: 'Fee structure deleted successfully' });
  } catch (err) { next(err); }
};

const updateFeeStructure = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, description, category, isOneTime, sortOrder } = req.body;
    const updated = await prisma.feeStructure.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(isOneTime !== undefined && { isOneTime: !!isOneTime }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
      },
    });
    res.json({ message: 'Fee structure updated', structure: updated });
  } catch (err) { next(err); }
};

/**
 * GET /api/fees/structures/defaults?classLevel=JSS|SS
 * Returns the built-in default fee schedule for secondary school classes.
 * Used for the "Load Defaults" seeder button on the frontend.
 */
const getDefaultFeeSchedule = async (req, res, next) => {
  try {
    const schedule = [
      // ── JSS 1 ──────────────────────────────────────────────
      { classPattern: 'JSS1', description: 'Application Form', amount: 2500, category: 'APPLICATION', isOneTime: true, sortOrder: 1 },
      { classPattern: 'JSS1', description: 'Uniform', amount: 7000, category: 'UNIFORM', isOneTime: false, sortOrder: 2 },
      { classPattern: 'JSS1', description: 'ID Card', amount: 2500, category: 'ID_CARD', isOneTime: false, sortOrder: 3 },
      { classPattern: 'JSS1', description: 'Tuition Fee', amount: 15000, category: 'TUITION', isOneTime: false, sortOrder: 4 },
      { classPattern: 'JSS1', description: 'Lesson Fee', amount: 8000, category: 'LESSON_FEE', isOneTime: false, sortOrder: 5 },
      { classPattern: 'JSS1', description: 'Sportswear', amount: 5000, category: 'SPORTSWEAR', isOneTime: false, sortOrder: 6 },
      { classPattern: 'JSS1', description: 'Friday Wear', amount: 2500, category: 'FRIDAY_WEAR', isOneTime: false, sortOrder: 7 },
      // ── JSS 2 ──────────────────────────────────────────────
      { classPattern: 'JSS2', description: 'Application Form', amount: 2500, category: 'APPLICATION', isOneTime: true, sortOrder: 1 },
      { classPattern: 'JSS2', description: 'Uniform', amount: 7000, category: 'UNIFORM', isOneTime: false, sortOrder: 2 },
      { classPattern: 'JSS2', description: 'ID Card', amount: 2500, category: 'ID_CARD', isOneTime: false, sortOrder: 3 },
      { classPattern: 'JSS2', description: 'Tuition Fee', amount: 15000, category: 'TUITION', isOneTime: false, sortOrder: 4 },
      { classPattern: 'JSS2', description: 'Lesson Fee', amount: 8000, category: 'LESSON_FEE', isOneTime: false, sortOrder: 5 },
      { classPattern: 'JSS2', description: 'Sportswear', amount: 5000, category: 'SPORTSWEAR', isOneTime: false, sortOrder: 6 },
      { classPattern: 'JSS2', description: 'Friday Wear', amount: 2500, category: 'FRIDAY_WEAR', isOneTime: false, sortOrder: 7 },
      // ── JSS 3 ──────────────────────────────────────────────
      { classPattern: 'JSS3', description: 'Application Form', amount: 2500, category: 'APPLICATION', isOneTime: true, sortOrder: 1 },
      { classPattern: 'JSS3', description: 'Uniform', amount: 8050, category: 'UNIFORM', isOneTime: false, sortOrder: 2 },
      { classPattern: 'JSS3', description: 'ID Card', amount: 2500, category: 'ID_CARD', isOneTime: false, sortOrder: 3 },
      { classPattern: 'JSS3', description: 'Tuition Fee', amount: 18000, category: 'TUITION', isOneTime: false, sortOrder: 4 },
      { classPattern: 'JSS3', description: 'Lesson Fee', amount: 10000, category: 'LESSON_FEE', isOneTime: false, sortOrder: 5 },
      { classPattern: 'JSS3', description: 'Sportswear', amount: 6000, category: 'SPORTSWEAR', isOneTime: false, sortOrder: 6 },
      { classPattern: 'JSS3', description: 'Friday Wear', amount: 2500, category: 'FRIDAY_WEAR', isOneTime: false, sortOrder: 7 },
      // ── SS 1 ───────────────────────────────────────────────
      { classPattern: 'SS1', description: 'Application Form', amount: 2500, category: 'APPLICATION', isOneTime: true, sortOrder: 1 },
      { classPattern: 'SS1', description: 'Uniform', amount: 8000, category: 'UNIFORM', isOneTime: false, sortOrder: 2 },
      { classPattern: 'SS1', description: 'ID Card', amount: 2500, category: 'ID_CARD', isOneTime: false, sortOrder: 3 },
      { classPattern: 'SS1', description: 'Tuition Fee', amount: 20000, category: 'TUITION', isOneTime: false, sortOrder: 4 },
      { classPattern: 'SS1', description: 'Lesson Fee', amount: 10000, category: 'LESSON_FEE', isOneTime: false, sortOrder: 5 },
      { classPattern: 'SS1', description: 'Sportswear', amount: 6000, category: 'SPORTSWEAR', isOneTime: false, sortOrder: 6 },
      { classPattern: 'SS1', description: 'Friday Wear', amount: 2500, category: 'FRIDAY_WEAR', isOneTime: false, sortOrder: 7 },
      // ── SS 2 ───────────────────────────────────────────────
      { classPattern: 'SS2', description: 'Application Form', amount: 2500, category: 'APPLICATION', isOneTime: true, sortOrder: 1 },
      { classPattern: 'SS2', description: 'Uniform', amount: 8000, category: 'UNIFORM', isOneTime: false, sortOrder: 2 },
      { classPattern: 'SS2', description: 'ID Card', amount: 2500, category: 'ID_CARD', isOneTime: false, sortOrder: 3 },
      { classPattern: 'SS2', description: 'Tuition Fee', amount: 22500, category: 'TUITION', isOneTime: false, sortOrder: 4 },
      { classPattern: 'SS2', description: 'Lesson Fee', amount: 10000, category: 'LESSON_FEE', isOneTime: false, sortOrder: 5 },
      { classPattern: 'SS2', description: 'Sportswear', amount: 6000, category: 'SPORTSWEAR', isOneTime: false, sortOrder: 6 },
      { classPattern: 'SS2', description: 'Friday Wear', amount: 2500, category: 'FRIDAY_WEAR', isOneTime: false, sortOrder: 7 },
      // ── SS 3 ───────────────────────────────────────────────
      { classPattern: 'SS3', description: 'Application Form', amount: 2500, category: 'APPLICATION', isOneTime: true, sortOrder: 1 },
      { classPattern: 'SS3', description: 'Uniform', amount: 8000, category: 'UNIFORM', isOneTime: false, sortOrder: 2 },
      { classPattern: 'SS3', description: 'ID Card', amount: 2500, category: 'ID_CARD', isOneTime: false, sortOrder: 3 },
      { classPattern: 'SS3', description: 'Tuition Fee', amount: 25000, category: 'TUITION', isOneTime: false, sortOrder: 4 },
      { classPattern: 'SS3', description: 'Lesson Fee', amount: 10000, category: 'LESSON_FEE', isOneTime: false, sortOrder: 5 },
      { classPattern: 'SS3', description: 'Sportswear', amount: 6000, category: 'SPORTSWEAR', isOneTime: false, sortOrder: 6 },
      { classPattern: 'SS3', description: 'Friday Wear', amount: 2500, category: 'FRIDAY_WEAR', isOneTime: false, sortOrder: 7 },
    ];
    res.json(schedule);
  } catch (err) { next(err); }
};

const bulkInvoiceClass = async (req, res, next) => {
  try {
    const { classId, term, session } = req.body;
    if (!classId || !term || !session) {
      return res.status(400).json({ message: 'classId, term, and session are required' });
    }

    const structures = await prisma.feeStructure.findMany({
      where: { classId, term, session }
    });

    if (structures.length === 0) {
      return res.status(400).json({ message: 'No fee structures configured for this class, term, and session. Please configure fees first.' });
    }

    const students = await prisma.student.findMany({
      where: { currentClassId: classId, status: 'ACTIVE' }
    });

    if (students.length === 0) {
      return res.status(400).json({ message: 'No active students found in this class to bill.' });
    }

    let createdCount = 0;
    let skippedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        for (const struct of structures) {
          const existing = await tx.payment.findFirst({
            where: {
              studentId: student.id,
              description: struct.description,
              term,
              session
            }
          });

          if (existing) {
            skippedCount++;
            continue;
          }

          const receiptNo = await generateReceiptNo(tx);
          await tx.payment.create({
            data: {
              studentId: student.id,
              amount: struct.amount,
              description: struct.description,
              session,
              term,
              receiptNo,
              status: 'PENDING'
            }
          });
          createdCount++;
        }
      }
    });

    res.json({
      message: `Billing completed successfully.`,
      summary: {
        invoicesGenerated: createdCount,
        skippedDuplicates: skippedCount,
        studentsBilled: students.length
      }
    });
  } catch (err) { next(err); }
};

module.exports = {
  getStudentFees,
  getLedger,
  getGlobalLedger,
  createInvoice,
  recordPayment,
  getReceipt,
  getOutstanding,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  bulkInvoiceClass,
  getDefaultFeeSchedule,
};
