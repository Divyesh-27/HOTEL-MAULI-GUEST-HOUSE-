import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export type DockItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

interface MobileDockProps {
  items: DockItem[];
  activeId: string;
  onItemClick: (id: string) => void;
  className?: string;
}

export const MobileDock: React.FC<MobileDockProps> = ({
  items,
  activeId,
  onItemClick,
  className
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={cn("flex justify-around items-center px-1 pt-1.5 pb-1 relative", className)}
    >
      {items.map((item) => {
        const isActive = activeId === item.id;
        const Icon = item.icon;
        
        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            aria-label={item.label}
            className="relative flex flex-col items-center justify-center w-16 py-1 rounded-lg m-touch-target z-10"
          >
            {/* Active Indicator Background */}
            {isActive && (
              <motion.div
                layoutId="dock-active-indicator"
                className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.3 }}
              />
            )}
            
            {/* Icon */}
            <motion.div
              animate={{ 
                scale: isActive ? 1.08 : 1.0,
                y: isActive ? -1.5 : 0,
                color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
              }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Icon
                className={cn('w-5 h-5 mb-0.5')}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
            </motion.div>
            
            {/* Label */}
            <motion.span
              animate={{
                opacity: isActive ? 1 : 0.8,
                color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
              }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                'text-[10px] leading-tight',
                isActive ? 'font-bold' : 'font-medium'
              )}
            >
              {item.label}
            </motion.span>
          </button>
        );
      })}
    </motion.div>
  );
};
