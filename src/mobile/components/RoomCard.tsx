import React from 'react';
import { cn } from '@/lib/utils';
import { Room, Booking, RoomStatusType } from '@/types';
import StatusChip from './StatusChip';

interface RoomCardProps {
  room: Room;
  status: RoomStatusType;
  guestName?: string;
  onClick?: () => void;
}

const RoomCard: React.FC<RoomCardProps> = ({ room, status, guestName, onClick }) => {
  return (
    <div
      className={cn(
        'm-room-card cursor-pointer',
        `m-room-card-${status}`,
      )}
      onClick={onClick}
    >
      {/* Top row: Room number + Status */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-lg font-extrabold text-foreground tracking-tight">{room.roomNo}</span>
        <StatusChip status={status} size="sm" />
      </div>

      {/* Bed type */}
      <div className="text-[11px] text-muted-foreground font-medium mb-1">{room.bedType}</div>

      {/* Guest name if occupied */}
      {status === 'occupied' && guestName && (
        <div className="text-xs font-semibold text-foreground truncate mt-1">{guestName}</div>
      )}

      {/* Price if available */}
      {status === 'available' && (
        <div className="text-xs font-bold text-status-available mt-1">₹{room.rent}/night</div>
      )}

      {/* Reserved indicator */}
      {status === 'reserved' && (
        <div className="text-[11px] font-medium text-status-reserved mt-1">Reserved</div>
      )}

      {/* Cleaning */}
      {status === 'cleaning' && (
        <div className="text-[11px] font-medium text-status-cleaning mt-1">Needs Cleaning</div>
      )}

      {/* Maintenance */}
      {status === 'maintenance' && (
        <div className="text-[11px] font-medium text-status-maintenance mt-1">Under Maintenance</div>
      )}
    </div>
  );
};

export default RoomCard;
