import React, { useEffect } from 'react';
import { AlertTriangle, HelpCircle, Info, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'warning',
  onConfirm,
  onCancel,
}) => {
  // Handle Escape key to cancel/close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-500" />;
      default:
        return <HelpCircle className="w-6 h-6 text-primary" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return "bg-red-600 hover:bg-red-700 text-white shadow-red-500/20";
      case 'warning':
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20";
      case 'info':
        return "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20";
      default:
        return "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20";
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border animate-scale-in">
        
        {/* Header */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <div className="p-3 bg-secondary rounded-full shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-foreground">{title}</h3>
              <button
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-secondary/30 border-t border-border flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl font-bold text-sm transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={cn(
              "px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center gap-1.5",
              getConfirmButtonClass()
            )}
          >
            <Check className="w-4 h-4" /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
