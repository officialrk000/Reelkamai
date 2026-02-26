import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get user earnings
router.get('/me', authenticate, (req: AuthRequest, res) => {
  const userId = req.user!.id;

  try {
    const earningsStmt = db.prepare('SELECT SUM(amount) as total FROM earnings WHERE user_id = ?');
    const totalEarnings = earningsStmt.get(userId) as { total: number };

    const withdrawalsStmt = db.prepare('SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ?');
    const totalWithdrawals = withdrawalsStmt.get(userId) as { total: number };

    const currentBalance = (totalEarnings.total || 0) - (totalWithdrawals.total || 0);

    const historyStmt = db.prepare('SELECT * FROM earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
    const history = historyStmt.all(userId);

    res.json({ balance: currentBalance, history });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch earnings' });
  }
});

// Request withdrawal
router.post('/withdraw', authenticate, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { amount, upiId } = req.body;

  if (!amount || !upiId) {
    return res.status(400).json({ message: 'Amount and UPI ID are required' });
  }

  try {
    // Check balance
    const earningsStmt = db.prepare('SELECT SUM(amount) as total FROM earnings WHERE user_id = ?');
    const totalEarnings = earningsStmt.get(userId) as { total: number };
    const withdrawalsStmt = db.prepare('SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ?');
    const totalWithdrawals = withdrawalsStmt.get(userId) as { total: number };
    const currentBalance = (totalEarnings.total || 0) - (totalWithdrawals.total || 0);

    if (currentBalance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const id = uuidv4();
    const stmt = db.prepare('INSERT INTO withdrawals (id, user_id, amount, upi_id) VALUES (?, ?, ?, ?)');
    stmt.run(id, userId, amount, upiId);

    res.json({ message: 'Withdrawal request submitted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to process withdrawal' });
  }
});

export default router;
