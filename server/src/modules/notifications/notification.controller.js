const prisma = require('../../config/db');

const getAll = async (req, res, next) => {
  try {
    const where = {};
    // Filter by role — PARENT/STUDENT see broadcast + their role
    if (['PARENT','STUDENT'].includes(req.user.role)) {
      where.OR = [{ targetRole: null }, { targetRole: req.user.role }];
    }
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ notifications });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { title, message, targetRole } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'title and message required' });
    const notification = await prisma.notification.create({
      data: { title, message, targetRole: targetRole || null, sentBy: req.user.id },
    });
    res.status(201).json({ message: 'Notification sent', notification });
  } catch (err) { next(err); }
};

// Mark as read — stored client-side (no DB column needed yet)
const markRead = (_req, res) => res.json({ message: 'Marked as read' });

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({ where: { id } });
    res.json({ message: 'Notification deleted' });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, markRead, remove };
