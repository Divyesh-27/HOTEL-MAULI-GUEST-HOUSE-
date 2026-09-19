import React from 'react';
import { cn } from '@/lib/utils';
import { Room } from '@/types';

interface RoomPickerProps {
  availableRooms: Room[];
  selectedRoomNos: string[];
  onToggleRoom: (roomNo: string) => void;
  heldRoomNos?: string[];
}

const RoomPicker: React.FC<RoomPickerProps> = ({
  availableRooms,
  selectedRoomNos,
  onToggleRoom,
  heldRoomNos = []
}) => {
  if (availableRooms.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center border rounded-xl border-dashed">
        No rooms available for these dates.
      </div>
    );
  }

  // Group rooms by category
  const groupedRooms: Record<string, Room[]> = {};
  availableRooms.forEach((r) => {
    const cat = r.category || 'Other';
    if (!groupedRooms[cat]) groupedRooms[cat] = [];
    groupedRooms[cat].push(r);
  });

  return (
    <div className="space-y-4">
      {Object.entries(groupedRooms).map(([category, categoryRooms]) => (
        <div key={category}>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-1.5 px-1">
            {category}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categoryRooms.map(room => {
              const isSelected = selectedRoomNos.includes(room.roomNo);
              const isHeld = heldRoomNos.includes(room.roomNo);
              return (
                <div 
                  key={room.roomNo} 
                  onClick={() => onToggleRoom(room.roomNo)} 
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-16 relative", 
                    isHeld ? "bg-secondary/50 cursor-not-allowed opacity-60" : "cursor-pointer active:scale-95",
                    isSelected && !isHeld
                      ? "bg-primary/10 border-primary ring-2 ring-primary/50" 
                      : (!isHeld && "bg-card hover:bg-secondary/50")
                  )}
                >
                  {isHeld && (
                    <div className="absolute top-1 right-1 text-[10px] text-destructive flex items-center gap-0.5 font-bold" title="Booking in progress on another device">
                      🔒
                    </div>
                  )}
                  <span className={cn(
                    "font-black",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {room.roomNo}
                  </span>
                  <span className="text-[10px] text-muted-foreground">₹{room.rent}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RoomPicker;
