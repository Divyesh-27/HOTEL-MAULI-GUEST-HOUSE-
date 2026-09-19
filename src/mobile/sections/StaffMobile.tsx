import React, { useState } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Users, UserCheck, IndianRupee, History } from 'lucide-react';
import BottomSheet from '@/mobile/components/BottomSheet';
import SegmentedToggle from '@/mobile/components/SegmentedToggle';

const StaffMobile: React.FC = () => {
  const staff = useMobileStore(s => s.staff);
  const staffLogs = useMobileStore(s => s.staffLogs);
  const addStaffLog = useMobileStore(s => s.addStaffLog);

  const [activeTab, setActiveTab] = useState<'attendance'|'payment'>('attendance');
  
  // Forms
  const [selectedStaff, setSelectedStaff] = useState('');
  const [amount, setAmount] = useState('');
  const [payType, setPayType] = useState<'Advance'|'Salary'>('Advance');

  const getBalance = (name: string) => {
    const s = staff.find(x => x.name === name);
    if (!s) return 0;
    const adv = staffLogs.filter(l => l.staff === name && l.type === 'Advance').reduce((sum, l) => sum + l.amount, 0);
    return s.salary - adv;
  };

  const handleAttendance = () => {
    if (!selectedStaff) return alert('Select staff');
    addStaffLog({
      date: new Date().toLocaleDateString(),
      staff: selectedStaff,
      type: 'Attendance',
      amount: 0,
      msg: `${selectedStaff} marked Present`
    });
    alert(`Attendance marked for ${selectedStaff}`);
    setSelectedStaff('');
  };

  const handlePayment = () => {
    if (!selectedStaff || !amount) return alert('Fill all fields');
    addStaffLog({
      date: new Date().toLocaleDateString(),
      staff: selectedStaff,
      type: payType,
      amount: parseFloat(amount) || 0,
      msg: `${selectedStaff}: ${payType} of ₹${amount}`
    });
    alert(`${payType} recorded for ${selectedStaff}`);
    setSelectedStaff('');
    setAmount('');
  };

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card p-3 rounded-xl border">
          <Users className="w-5 h-5 text-primary mb-2" />
          <h4 className="text-xl font-black">{staff.length}</h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Staff</p>
        </div>
        <div className="bg-card p-3 rounded-xl border">
          <History className="w-5 h-5 text-status-reserved mb-2" />
          <h4 className="text-xl font-black">{staffLogs.length}</h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Logs Recorded</p>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-card rounded-xl border p-4 space-y-3">
        <h3 className="font-bold text-sm">Staff Balances</h3>
        {staff.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No staff added.</p>
        ) : (
          staff.map(s => (
            <div key={s.name} className="flex justify-between items-center p-2.5 bg-secondary/30 rounded-lg border text-sm">
              <div>
                <span className="font-bold">{s.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{s.role}</span>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-foreground">Rem: ₹{getBalance(s.name)}</div>
                <div className="text-[10px] text-muted-foreground">Salary: ₹{s.salary}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Area */}
      <div className="bg-card rounded-xl border p-4">
        <SegmentedToggle 
          options={[{id:'attendance', label:'Mark Attendance'}, {id:'payment', label:'Record Payment'}]} 
          activeId={activeTab} 
          onChange={id => setActiveTab(id as any)} 
        />
        
        <div className="mt-4 space-y-3">
          <select 
            value={selectedStaff} 
            onChange={e => setSelectedStaff(e.target.value)} 
            className="m-input bg-background w-full"
          >
            <option value="">-- Select Staff --</option>
            {staff.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>

          {activeTab === 'attendance' ? (
            <button onClick={handleAttendance} className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-lg flex justify-center items-center gap-2 active:scale-95 transition-transform">
              <UserCheck className="w-4 h-4" /> Mark Present
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="number" 
                  placeholder="Amount (₹)" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  className="m-input bg-background" 
                />
                <select 
                  value={payType} 
                  onChange={e => setPayType(e.target.value as any)} 
                  className="m-input bg-background"
                >
                  <option value="Advance">Advance</option>
                  <option value="Salary">Salary</option>
                </select>
              </div>
              <button onClick={handlePayment} className="w-full h-11 bg-status-reserved text-white font-bold rounded-lg flex justify-center items-center gap-2 active:scale-95 transition-transform shadow-md">
                <IndianRupee className="w-4 h-4" /> Record Transaction
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffMobile;
