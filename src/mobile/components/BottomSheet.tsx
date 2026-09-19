import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bottom-sheet-overlay fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bottom-sheet-content fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-xl border-t border-border"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
          >
            <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-2" />
            {title && (
              <div className="px-5 pb-2 pt-1">
                <h3 className="text-base font-bold text-foreground">{title}</h3>
              </div>
            )}
            <div className="px-5 pb-4 max-h-[85vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
