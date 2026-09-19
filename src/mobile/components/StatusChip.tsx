import React from 'react';
import { cn } from '@/lib/utils';
import { RoomStatusType } from '@/types';

interface StatusChipProps {
  status: RoomStatusType;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<RoomStatusType, { label: string; dotClass: string; bgClass: string; textClass: string }> = {
  available: { label: 'Available', dotClass: 'status-dot-available', bgClass: 'bg-status-available/10', textClass: 'text-status-available' },
  occupied: { label: 'Occupied', dotClass: 'status-dot-occupied', bgClass: 'bg-status-occupied/10', textClass: 'text-status-occupied' },
  reserved: { label: 'Reserved', dotClass: 'status-dot-reserved', bgClass: 'bg-status-reserved/10', textClass: 'text-status-reserved' },
  cleaning: { label: 'Cleaning', dotClass: 'status-dot-cleaning', bgClass: 'bg-status-cleaning/10', textClass: 'text-status-cleaning' },
  maintenance: { label: 'Maintenance', dotClass: 'status-dot-maintenance', bgClass: 'bg-status-maintenance/10', textClass: 'text-status-maintenance' },
};

const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'sm' }) => {
  const config = STATUS_CONFIG[status];
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wider',
      config.bgClass,
      config.textClass,
      size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
    )}>
      <span className={cn('status-dot', config.dotClass)} style={size === 'sm' ? { width: 6, height: 6 } : undefined} />
      {config.label}
    </span>
  );
};

export { STATUS_CONFIG };
export default StatusChip;
