const prisma = require('../../config/db');

/**
 * POST /api/bill-letters/generate
 * Generate a fee letter for one parent/student (student need not be registered).
 * Body: { parentName, studentName, className, classId?, studentId?, term, session, items[], notes? }
 * items[]  = [{ feeLabel, category?, originalAmount, discountPercent?, isScholarship?, isIncluded?, sortOrder? }]
 */
const generateLetter = async (req, res, next) => {
    try {
        const {
            parentName, studentName, className, classId, studentId,
            term, session, notes, items = []
        } = req.body;

        if (!parentName || !studentName || !className || !term || !session) {
            return res.status(400).json({
                message: 'parentName, studentName, className, term, session are required'
            });
        }
        if (!items.length) {
            return res.status(400).json({ message: 'At least one fee item is required' });
        }

        const computedItems = items.map((item, idx) => {
            const disc = parseFloat(item.discountPercent || 0);
            const orig = parseFloat(item.originalAmount || 0);
            const final = item.isScholarship ? 0 : orig * (1 - disc / 100);
            return {
                feeLabel: item.feeLabel,
                category: item.category || null,
                originalAmount: orig,
                discountPercent: disc,
                isScholarship: !!item.isScholarship,
                finalAmount: final,
                isIncluded: item.isIncluded !== false,
                sortOrder: item.sortOrder ?? idx,
            };
        });

        const letter = await prisma.billLetter.create({
            data: {
                parentName,
                studentName,
                className,
                classId: classId || null,
                studentId: studentId || null,
                term,
                session,
                notes: notes || null,
                generatedBy: req.user.id,
                items: { create: computedItems },
            },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
        });

        res.status(201).json({ message: 'Fee letter generated successfully', letter });
    } catch (err) { next(err); }
};

/**
 * POST /api/bill-letters/generate-class
 * Bulk-generate one fee letter per student in a class.
 * Body: { classId, term, session, items[], notes? }
 * All letters share the same fee configuration; parent name comes from student records.
 */
const generateClassLetters = async (req, res, next) => {
    try {
        const { classId, term, session, notes, items = [] } = req.body;

        if (!classId || !term || !session) {
            return res.status(400).json({ message: 'classId, term, session are required' });
        }
        if (!items.length) {
            return res.status(400).json({ message: 'At least one fee item is required' });
        }

        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(404).json({ message: 'Class not found' });

        const students = await prisma.student.findMany({
            where: { currentClassId: classId, status: 'ACTIVE' },
            include: { parent: true },
        });

        if (!students.length) {
            return res.status(400).json({ message: 'No active students found in this class' });
        }

        const computeItems = (baseItems) =>
            baseItems.map((item, idx) => {
                const disc = parseFloat(item.discountPercent || 0);
                const orig = parseFloat(item.originalAmount || 0);
                const final = item.isScholarship ? 0 : orig * (1 - disc / 100);
                return {
                    feeLabel: item.feeLabel,
                    category: item.category || null,
                    originalAmount: orig,
                    discountPercent: disc,
                    isScholarship: !!item.isScholarship,
                    finalAmount: final,
                    isIncluded: item.isIncluded !== false,
                    sortOrder: item.sortOrder ?? idx,
                };
            });

        const created = [];
        await prisma.$transaction(async (tx) => {
            for (const student of students) {
                const parentName = student.parent?.name || 'Parent/Guardian';
                const studentName = `${student.lastName} ${student.firstName}`;

                const letter = await tx.billLetter.create({
                    data: {
                        parentName,
                        studentName,
                        className: cls.name,
                        classId: cls.id,
                        studentId: student.id,
                        term,
                        session,
                        notes: notes || null,
                        generatedBy: req.user.id,
                        items: { create: computeItems(items) },
                    },
                    include: { items: { orderBy: { sortOrder: 'asc' } } },
                });
                created.push(letter);
            }
        });

        res.status(201).json({
            message: `${created.length} fee letters generated for ${cls.name}`,
            count: created.length,
            letters: created,
        });
    } catch (err) { next(err); }
};

/**
 * GET /api/bill-letters
 * List all letters (admin). Supports ?classId=, ?term=, ?session= filters.
 */
const listLetters = async (req, res, next) => {
    try {
        const { classId, term, session, search } = req.query;
        const where = {};
        if (classId) where.classId = classId;
        if (term) where.term = term;
        if (session) where.session = session;
        if (search) {
            where.OR = [
                { parentName: { contains: search, mode: 'insensitive' } },
                { studentName: { contains: search, mode: 'insensitive' } },
            ];
        }

        const letters = await prisma.billLetter.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                items: { where: { isIncluded: true }, orderBy: { sortOrder: 'asc' } },
            },
        });

        res.json(letters);
    } catch (err) { next(err); }
};

/**
 * GET /api/bill-letters/:id
 * Get a single letter with all items.
 */
const getLetter = async (req, res, next) => {
    try {
        const letter = await prisma.billLetter.findUnique({
            where: { id: req.params.id },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!letter) return res.status(404).json({ message: 'Letter not found' });
        res.json(letter);
    } catch (err) { next(err); }
};

/**
 * GET /api/bill-letters/student/:studentId
 * Parent portal: get all letters for their child.
 */
const getLettersByStudent = async (req, res, next) => {
    try {
        const letters = await prisma.billLetter.findMany({
            where: { studentId: req.params.studentId },
            orderBy: { createdAt: 'desc' },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
        res.json(letters);
    } catch (err) { next(err); }
};

/**
 * DELETE /api/bill-letters/:id
 */
const deleteLetter = async (req, res, next) => {
    try {
        await prisma.billLetter.delete({ where: { id: req.params.id } });
        res.json({ message: 'Letter deleted' });
    } catch (err) { next(err); }
};

module.exports = {
    generateLetter,
    generateClassLetters,
    listLetters,
    getLetter,
    getLettersByStudent,
    deleteLetter,
};
