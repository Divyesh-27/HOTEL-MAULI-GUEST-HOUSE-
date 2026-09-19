import React from 'react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  filters: { id: string; label: string; count?: number }[];
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, activeFilter, onFilterChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {filters.map((f) => (
        <button
          key={f.id}
          className={cn(
            'filter-pill shrink-0 m-touch-target flex items-center gap-1',
            activeFilter === f.id ? 'filter-pill-active' : 'filter-pill-inactive'
          )}
          onClick={() => onFilterChange(f.id)}
        >
          {f.label}
          {f.count !== undefined && (
            <span className={cn(
              'text-[10px] font-bold ml-0.5',
              activeFilter === f.id ? 'text-primary-foreground/80' : 'text-muted-foreground/60'
            )}>
              {f.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default FilterBar;
