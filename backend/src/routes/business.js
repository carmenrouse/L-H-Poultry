const express = require('express');
const { body } = require('express-validator');

const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const business = await prisma.business.findUnique({ where: { id: req.user.businessId } });
    res.json(business);
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/',
  requireRole('OWNER'),
  [
    body('name').optional().isString().trim().notEmpty(),
    body('taxRate').optional().isFloat({ min: 0, max: 1 }),
    body('allowNegativeStock').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const business = await prisma.business.update({
        where: { id: req.user.businessId },
        data: req.body,
      });
      res.json(business);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
