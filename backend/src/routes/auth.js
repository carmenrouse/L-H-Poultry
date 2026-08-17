const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');

const prisma = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user.id, businessId: user.businessId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );
}

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// Register a brand-new Business along with its first Owner user.
router.post(
  '/register-business',
  [
    body('businessName').isString().trim().notEmpty(),
    body('ownerName').isString().trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { businessName, ownerName, email, password } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);

      const business = await prisma.business.create({
        data: {
          name: businessName,
          users: {
            create: {
              email,
              name: ownerName,
              passwordHash,
              role: 'OWNER',
            },
          },
        },
        include: { users: true },
      });

      const owner = business.users[0];
      const token = signToken(owner);
      res.status(201).json({ token, user: toPublicUser(owner), business: { id: business.id, name: business.name } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findFirst({ where: { email } });
      if (!user || !user.active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = signToken(user);
      res.json({ token, user: toPublicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

module.exports = router;
