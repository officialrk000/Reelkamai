import React, { useEffect, useState } from 'react';
import { IndianRupee, History, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, getDocs, doc, updateDoc, addDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface Earning {
  id: string;
  amount: number;
  type: string;
  created_at: string;
}

export default function Earnings() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Earning[]>([]);
  const [upiId, setUpiId] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEarnings = async () => {
      if (!user) return;
      try {
        // Fetch latest user data to get accurate coin balance
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          setBalance(userDoc.data().coins || 0);
        } else {
          setBalance(0);
        }

        const q = query(
          collection(db, 'users', user.id, 'earnings'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const historyData = snapshot.docs.map(doc => ({
          id: doc.id,
          amount: doc.data().amount,
          type: doc.data().type,
          created_at: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
        }));
        setHistory(historyData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, [user]);

  const handleWithdraw = async () => {
    if (!upiId || !withdrawAmount || !user) return;
    const amount = Number(withdrawAmount);
    if (amount > balance) {
      alert('Insufficient balance');
      return;
    }
    
    try {
      // 1. Create withdrawal request
      await addDoc(collection(db, 'withdrawals'), {
        userId: user.id,
        username: user.username,
        amount: amount,
        upiId: upiId,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 2. Deduct from user balance
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        balance: increment(-amount)
      });

      // 3. Add to history
      await addDoc(collection(db, 'users', user.id, 'earnings'), {
        amount: -amount,
        type: 'withdrawal',
        createdAt: serverTimestamp()
      });
      
      alert('Withdrawal request submitted!');
      setBalance(prev => prev - amount);
      setWithdrawAmount('');
      
      // Update history locally
      setHistory(prev => [{
        id: 'temp-' + Date.now(),
        amount: -amount,
        type: 'withdrawal',
        created_at: new Date().toISOString()
      }, ...prev]);

    } catch (err) {
      console.error(err);
      alert('Withdrawal failed');
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center bg-black text-white">Loading...</div>;

  return (
    <div className="h-full bg-gradient-to-b from-gray-900 to-black text-white p-6 overflow-y-auto pb-24">
      <h1 className="text-xl font-bold mb-6 flex items-center gap-2 text-yellow-400">
        <Wallet className="text-yellow-400" />
        Earnings
      </h1>

      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 mb-6 border border-yellow-500/20 shadow-lg shadow-yellow-500/5">
        <p className="text-gray-400 text-sm mb-1">Total Coins</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-yellow-400 drop-shadow-sm">{balance}</span>
          <span className="text-xs text-yellow-200/70">Coins</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">100 Coins = ₹1</p>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
        <h2 className="font-bold mb-4 text-indigo-400">Withdraw</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="user@upi"
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount (Coins)</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Min 100"
              className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!upiId || !withdrawAmount || Number(withdrawAmount) > balance}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
          >
            Withdraw
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-bold mb-4 flex items-center gap-2 text-gray-300">
          <History size={16} />
          History
        </h2>
        <div className="space-y-2">
          {history.map((item) => (
            <div key={item.id} className="bg-gray-900/50 p-3 rounded-xl flex justify-between items-center border border-white/5 hover:bg-gray-800/50 transition-colors">
              <div>
                <p className="text-sm font-medium capitalize text-gray-200">{item.type} Reward</p>
                <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</p>
              </div>
              <span className={item.amount > 0 ? "text-green-400 font-bold text-sm" : "text-red-400 font-bold text-sm"}>
                {item.amount > 0 ? '+' : ''}{item.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
