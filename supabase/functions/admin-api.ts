import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Middleware to check if user is admin
const isAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Dashboard stats
router.get('/dashboard/stats', isAdmin, async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });
    const totalCalculators = await prisma.calculatorFeature.count();
    const enabledCalculators = await prisma.calculatorFeature.count({
      where: { enabled: true }
    });
    const totalCalculations = await prisma.calculation.count();
    const users = await prisma.user.findMany({
      select: { loginCount: true }
    });
    const avgLoginCount = users.length > 0
      ? users.reduce((sum, u) => sum + (u.loginCount || 0), 0) / users.length
      : 0;

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalCalculators,
        enabledCalculators,
        totalCalculations,
        avgLoginCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all users
router.get('/users', isAdmin, async (req: Request, res: Response) => {
  try {
    const { role } = req.query;
    const where = role && role !== 'ALL' ? { role } : {};
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        organization: true,
        department: true,
        lastLoginAt: true,
        loginCount: true
      }
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Suspend user
router.post('/users/:userId/suspend', isAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Activate user
router.post('/users/:userId/activate', isAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

// Get all calculators
router.get('/calculators', isAdmin, async (req: Request, res: Response) => {
  try {
    const calculators = await prisma.calculatorFeature.findMany();
    res.json({ calculators });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch calculators' });
  }
});

// Toggle calculator
router.post('/calculators/:calculatorId/toggle', isAdmin, async (req: Request, res: Response) => {
  try {
    const { calculatorId } = req.params;
    const { enabled } = req.body;
    await prisma.calculatorFeature.update({
      where: { id: calculatorId },
      data: { enabled }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle calculator' });
  }
});

// Toggle calculator visibility
router.post('/calculators/:calculatorId/visibility', isAdmin, async (req: Request, res: Response) => {
  try {
    const { calculatorId } = req.params;
    const { isPublic } = req.body;
    await prisma.calculatorFeature.update({
      where: { id: calculatorId },
      data: { isPublic }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle visibility' });
  }
});

// Unlock all calculators
router.post('/calculators/unlock-all', isAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.calculatorFeature.updateMany({
      data: { enabled: true, isPublic: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unlock calculators' });
  }
});

// Get all calculations
router.get('/calculations', isAdmin, async (req: Request, res: Response) => {
  try {
    const calculations = await prisma.calculation.findMany({
      select: {
        id: true,
        userId: true,
        calculatorType: true,
        name: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ calculations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch calculations' });
  }
});

export default router;
