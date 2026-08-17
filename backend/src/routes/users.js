const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');

const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(authenticate);

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// Owner manages staff accounts.
router.get('/', requireRole('OWNER'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ where: { businessId: req.user.businessId } });
    res.json(users.map(toPublicUser));
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireRole('OWNER'),
  [
    body('email').isEmail().normalizeEmail(),
    body('name').isString().trim().notEmpty(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['OWNER', 'MANAGER', 'CASHIER']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, name, password, role } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { businessId: req.user.businessId, email, name, passwordHash, role },
      });
      res.status(201).json(toPublicUser(user));
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id',
  requireRole('OWNER'),
  [
    body('name').optional().isString().trim().notEmpty(),
    body('role').optional().isIn(['OWNER', 'MANAGER', 'CASHIER']),
    body('active').optional().isBoolean(),
    body('password').optional().isLength({ min: 8 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const existing = await prisma.user.findFirst({
        where: { id: req.params.id, businessId: req.user.businessId },
      });
      if (!existing) throw new ApiError(404, 'User not found');

      const data = {};
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.role !== undefined) data.role = req.body.role;
      if (req.body.active !== undefined) data.active = req.body.active;
      if (req.body.password) data.passwordHash = await bcrypt.hash(req.body.password, 10);

      const user = await prisma.user.update({ where: { id: existing.id }, data });
      res.json(toPublicUser(user));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
