import React, { useState } from 'react';
import { useMobileStore } from '@/mobile/store/useMobileStore';
import { Room } from '@/types';
import { Building2, Plus, Edit2, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import BottomSheet from '@/mobile/components/BottomSheet';
import { pushMobileRoomStatusToCloud } from '@/mobile/lib/mobileSyncActions';

const AdminMobile: React.FC = () => {
  const rooms = useMobileStore(s => s.rooms);
  const roomStatus = useMobileStore(s => s.roomStatus);
  const addRoom = useMobileStore(s => s.addRoom);
  const updateRoom = useMobileStore(s => s.updateRoom);
  const setRoomStatus = useMobileStore(s => s.updateRoomStatus);
  
  const customCategories = useMobileStore(s => s.customCategories || ['AC', 'Non-AC', 'Hall']);
  const customBedTypes = useMobileStore(s => s.customBedTypes || ['Single', 'Double', 'King']);

  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [editingRoomNo, setEditingRoomNo] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Room>>({
    roomNo: '', category: 'AC', bedType: 'Double', rent: 1000
  });

  const handleOpenNew = () => {
    setEditingRoomNo(null);
    setForm({ roomNo: '', category: customCategories[0], bedType: customBedTypes[0], rent: 1000 });
    setBottomSheetOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoomNo(room.roomNo);
    setForm(room);
    setBottomSheetOpen(true);
  };

  const handleSave = () => {
    if (!form.roomNo || !form.rent) return alert('Room No and Rent are required');
    
    if (editingRoomNo) {
      updateRoom(editingRoomNo, form as Room);
    } else {
      if (rooms.some(r => r.roomNo === form.roomNo)) return alert('Room already exists');
      addRoom(form as Room);
    }
    setBottomSheetOpen(false);
  };

  const toggleMaintenance = async (roomNo: string) => {
    const isMaintenance = roomStatus[roomNo] === 'maintenance';
    const newStatus = isMaintenance ? null : 'maintenance';
    
    setRoomStatus(roomNo, newStatus);
    if (newStatus === 'maintenance') {
      await pushMobileRoomStatusToCloud(roomNo, 'maintenance');
    } else {
      await pushMobileRoomStatusToCloud(roomNo, 'available'); // Revert to available logically on cloud
    }
  };

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Room Management
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Manage rooms and maintenance status</p>
        </div>
        <button 
          onClick={handleOpenNew}
          className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-lg active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-2 gap-3">
        {rooms.map(room => {
          const isMaint = roomStatus[room.roomNo] === 'maintenance';
          
          return (
            <div key={room.roomNo} className={cn(
              "p-3 border rounded-xl relative",
              isMaint ? "bg-status-maintenance/10 border-status-maintenance/30" : "bg-card"
            )}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-black text-lg">{room.roomNo}</span>
                <button onClick={() => handleOpenEdit(room)} className="p-1 text-muted-foreground hover:text-primary active:scale-95">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                <p>{room.category} • {room.bedType}</p>
                <p className="font-bold text-foreground">₹{room.rent}/night</p>
              </div>
              
              <button
                onClick={() => toggleMaintenance(room.roomNo)}
                className={cn(
                  "w-full py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all",
                  isMaint 
                    ? "bg-status-maintenance text-white" 
                    : "bg-secondary text-muted-foreground"
                )}
              >
                <Wrench className="w-3 h-3" />
                {isMaint ? 'In Maintenance' : 'Mark Maintenance'}
              </button>
            </div>
          );
        })}
      </div>

      <BottomSheet open={bottomSheetOpen} onClose={() => setBottomSheetOpen(false)} title={editingRoomNo ? 'Edit Room' : 'Add Room'}>
        <div className="space-y-4 pt-2">
          <div>
            <label className="m-label">Room Number *</label>
            <input 
              type="text" 
              value={form.roomNo} 
              onChange={e => setForm({...form, roomNo: e.target.value})}
              disabled={!!editingRoomNo}
              className="m-input disabled:opacity-50" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="m-label">Category</label>
              <select 
                value={form.category} 
                onChange={e => setForm({...form, category: e.target.value as any})}
                className="m-input bg-card"
              >
                {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="m-label">Bed Type</label>
              <select 
                value={form.bedType} 
                onChange={e => setForm({...form, bedType: e.target.value})}
                className="m-input bg-card"
              >
                {customBedTypes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          
          <div>
            <label className="m-label">Rent per Night (₹) *</label>
            <input 
              type="number" 
              value={form.rent} 
              onChange={e => setForm({...form, rent: parseInt(e.target.value)||0})}
              className="m-input" 
            />
          </div>
          
          <button 
            onClick={handleSave}
            className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-bold shadow-md active:scale-95"
          >
            Save Room
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default AdminMobile;
