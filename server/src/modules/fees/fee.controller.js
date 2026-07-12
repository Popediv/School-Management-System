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
    const { classId, description, amount, session, term } = req.body;
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
      update: { amount: parseFloat(amount) },
      create: {
        classId,
        description,
        amount: parseFloat(amount),
        session,
        term
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
  createInvoice,
  recordPayment,
  getReceipt,
  getOutstanding,
  getFeeStructures,
  createFeeStructure,
  deleteFeeStructure,
  bulkInvoiceClass
};
