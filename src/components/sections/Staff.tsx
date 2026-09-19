import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/store/useStore';

import { useShallow } from 'zustand/react/shallow';

const Staff = () => {
  const { staff, staffLogs, addStaff, removeStaff, addStaffLog } = useStore(useShallow(state => ({
    staff: state.staff,
    staffLogs: state.staffLogs,
    addStaff: state.addStaff,
    removeStaff: state.removeStaff,
    addStaffLog: state.addStaffLog
  })));
  
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: '',
    salary: 0,
  });
  
  const [attendance, setAttendance] = useState('');
  const [payment, setPayment] = useState({
    staff: '',
    amount: 0,
    type: 'Advance' as 'Advance' | 'Salary',
  });

  const handleAddStaff = (e: FormEvent) => {
    e.preventDefault();
    if (newStaff.name && newStaff.salary) {
      addStaff(newStaff);
      setNewStaff({ name: '', role: '', salary: 0 });
    }
  };

  const handleDeleteStaff = (index: number) => {
    if (confirm('Remove staff member?')) {
      removeStaff(index);
    }
  };

  const handleMarkAttendance = () => {
    if (!attendance) return;
    addStaffLog({
      date: new Date().toLocaleDateString(),
      staff: attendance,
      type: 'Attendance',
      amount: 0,
      msg: `${attendance} marked Present`,
    });
    setAttendance('');
  };

  const handleRecordPayment = () => {
    if (!payment.staff || !payment.amount) return;
    addStaffLog({
      date: new Date().toLocaleDateString(),
      staff: payment.staff,
      type: payment.type,
      amount: payment.amount,
      msg: `${payment.staff}: ${payment.type} of ₹${payment.amount}`,
    });
    setPayment({ ...payment, amount: 0 });
  };

  const getStaffBalance = (name: string) => {
    const staffMember = staff.find((s) => s.name === name);
    if (!staffMember) return 0;
    const advances = staffLogs
      .filter((l) => l.staff === name && l.type === 'Advance')
      .reduce((sum, l) => sum + l.amount, 0);
    return staffMember.salary - advances;
  };

  return (
    <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Staff List */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="font-bold text-lg mb-4">Staff Members</h3>
        <form onSubmit={handleAddStaff} className="mb-4 grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Name"
            value={newStaff.name}
            onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
            className="px-3 py-2 border rounded text-sm"
          />
          <input
            type="text"
            placeholder="Role"
            value={newStaff.role}
            onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
            className="px-3 py-2 border rounded text-sm"
          />
          <input
            type="number"
            placeholder="Salary (₹)"
            value={newStaff.salary || ''}
            onChange={(e) => setNewStaff({ ...newStaff, salary: parseFloat(e.target.value) || 0 })}
            className="px-3 py-2 border rounded text-sm"
          />
          <button
            type="submit"
            className="col-span-3 bg-primary text-primary-foreground py-2 rounded font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Add Staff
          </button>
        </form>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No staff added yet.</p>
          ) : (
            staff.map((s, index) => (
              <div key={s.name} className="flex justify-between items-center p-2 border-b text-sm">
                <div>
                  <span className="font-bold">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">({s.role})</span>
                  <div className="text-xs text-muted">
                    Salary: ₹{s.salary} | Rem: ₹{getStaffBalance(s.name)}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteStaff(index)}
                  className="text-destructive/60 hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Attendance & Payments */}
      <div className="space-y-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="font-bold text-lg mb-4">Daily Attendance</h3>
          <div className="flex gap-2">
            <select
              value={attendance}
              onChange={(e) => setAttendance(e.target.value)}
              className="flex-1 px-3 py-2 border rounded text-sm"
            >
              <option value="">Select Staff</option>
              {staff.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleMarkAttendance}
              className="bg-status-available text-white px-4 py-2 rounded font-bold text-sm hover:opacity-90 transition-colors"
            >
              Mark Present
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h3 className="font-bold text-lg mb-4">Payment & Advance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <select
              value={payment.staff}
              onChange={(e) => setPayment({ ...payment, staff: e.target.value })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="">Select Staff</option>
              {staff.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount (₹)"
              value={payment.amount || ''}
              onChange={(e) => setPayment({ ...payment, amount: parseFloat(e.target.value) || 0 })}
              className="px-3 py-2 border rounded text-sm"
            />
            <select
              value={payment.type}
              onChange={(e) => setPayment({ ...payment, type: e.target.value as 'Advance' | 'Salary' })}
              className="px-3 py-2 border rounded text-sm"
            >
              <option value="Advance">Advance</option>
              <option value="Salary">Salary Payout</option>
            </select>
          </div>
          <button
            onClick={handleRecordPayment}
            className="w-full bg-status-available text-white py-2 rounded font-bold text-sm hover:opacity-90 transition-colors"
          >
            Record Transaction
          </button>

          <h4 className="font-bold text-sm mt-6 mb-2 text-muted-foreground">Recent Transactions</h4>
          <ul className="text-xs text-muted-foreground space-y-1 h-32 overflow-y-auto border-t pt-2">
            {staffLogs.slice(0, 20).map((log, index) => (
              <li key={index}>[{log.date}] {log.msg}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Staff;
