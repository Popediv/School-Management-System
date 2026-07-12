const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const prisma = require('../../config/db');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    
    // If not found by email, try to find a student by moodleUsername or admissionNo
    if (!user) {
      const student = await prisma.student.findFirst({
        where: {
          OR: [
            { moodleUsername: email.toLowerCase() },
            { admissionNo: { equals: email, mode: 'insensitive' } }
          ]
        },
        include: { user: true }
      });
      if (student && student.user) {
        user = student.user;
      }
    }

    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Invalid email/username or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Invalid email or password' });

    const token = signToken(user);
    const { password: _, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) { next(err); }
};

// POST /api/auth/logout
const logout = (_req, res) => res.json({ message: 'Logged out successfully' });

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id:true, name:true, email:true, role:true, isActive:true, createdAt:true }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
};

// POST /api/auth/register  (admin only — creates system users)
const register = async (req, res, next) => {
  try {
    // Only SUPER_ADMIN can create users
    if (req.user.role !== 'SUPER_ADMIN')
      return res.status(403).json({ message: 'Only Super Admin can create users' });

    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role)
      return res.status(400).json({ message: 'name, email, password, role are required' });

    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: { name, email: email.toLowerCase(), password: hashed, role },
      select: { id:true, name:true, email:true, role:true, createdAt:true }
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: 'Incorrect current password' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed }
    });

    res.json({ message: 'Password changed successfully!' });
  } catch (err) { next(err); }
};

const getUserPassword = async (req, res, next) => {
  try {
    // Only SUPER_ADMIN can view password hashes
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id }, select: { password: true, email: true } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Return hashed password (not plain) for admin audit
    res.json({ email: user.email, passwordHash: user.password });
  } catch (err) { next(err); }
};

const adminResetPassword = async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'newPassword required' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
};

module.exports = { login, logout, getMe, register, changePassword, getUserPassword, adminResetPassword };
