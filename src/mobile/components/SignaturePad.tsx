import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  label: string;
  onClear?: () => void;
}

export interface SignaturePadRef {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, onClear }, ref) => {
    const sigPadRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      isEmpty: () => {
        return sigPadRef.current?.isEmpty() || true;
      },
      toDataURL: () => {
        return sigPadRef.current?.toDataURL() || '';
      },
      clear: () => {
        sigPadRef.current?.clear();
      }
    }));

    const handleClear = () => {
      sigPadRef.current?.clear();
      if (onClear) onClear();
    };

    return (
      <div className="border rounded-xl p-4 bg-card">
        <label className="block text-xs mb-2 font-bold flex justify-between items-center">
          <span>{label}</span>
          <button 
            type="button" 
            onClick={handleClear} 
            className="text-destructive font-bold text-[10px]"
          >
            CLEAR
          </button>
        </label>
        <div className="h-32 border-2 border-dashed rounded-lg bg-secondary/10 relative">
          <SignatureCanvas 
            ref={sigPadRef} 
            canvasProps={{ className: 'w-full h-full' }} 
          />
          <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground pointer-events-none">
            Sign Here
          </div>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';

export default SignaturePad;
