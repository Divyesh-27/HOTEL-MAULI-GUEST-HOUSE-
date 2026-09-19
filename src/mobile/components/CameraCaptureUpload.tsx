import React from 'react';
import { Camera } from 'lucide-react';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

interface CameraCaptureUploadProps {
  label: string;
  imageUri: string | null;
  onCapture: (dataUri: string) => void;
  onClear: () => void;
}

const isMobilePlatform = (): boolean => {
  try {
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    if ((window as any).Capacitor?.getPlatform?.() === 'android') return true;
  } catch {}
  return false;
};

const CameraCaptureUpload: React.FC<CameraCaptureUploadProps> = ({
  label,
  imageUri,
  onCapture,
  onClear
}) => {
  const handleCapture = async () => {
    try {
      const image = await CapacitorCamera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      if (image.dataUrl) {
        onCapture(image.dataUrl);
      }
    } catch (e) {
      console.warn("Camera failed or cancelled", e);
      
      // Fallback for web if Capacitor camera fails (e.g., not on native device without PWA elements)
      if (!isMobilePlatform()) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                onCapture(event.target.result as string);
              }
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      }
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-card">
      <label className="block text-xs mb-2 font-bold flex justify-between items-center">
        <span>{label}</span>
        {imageUri && <span className="text-primary">Captured ✓</span>}
      </label>
      
      {!imageUri ? (
        <button 
          type="button" 
          onClick={handleCapture} 
          className="w-full h-16 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/50 active:scale-95 transition-all"
        >
          <Camera className="w-5 h-5" />
          <span className="font-bold text-sm">Take Photo</span>
        </button>
      ) : (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border">
          <img src={imageUri} alt="Captured preview" className="w-full h-full object-cover" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button 
              type="button" 
              onClick={handleCapture} 
              className="bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md"
            >
              Retake
            </button>
            <button 
              type="button" 
              onClick={onClear} 
              className="bg-destructive/80 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCaptureUpload;
