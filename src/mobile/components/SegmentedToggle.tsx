import React from 'react';
import { cn } from '@/lib/utils';

interface SegmentedToggleProps {
  options: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}

const SegmentedToggle: React.FC<SegmentedToggleProps> = ({ options, activeId, onChange }) => {
  return (
    <div className="flex items-center justify-center gap-1.5 bg-secondary/30 p-1 rounded-lg border">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "flex-1 py-1.5 text-xs font-bold rounded-md transition-all",
            activeId === option.id 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "text-muted-foreground hover:bg-secondary/50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default SegmentedToggle;
