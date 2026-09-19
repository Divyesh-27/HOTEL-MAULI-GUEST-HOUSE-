import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

// Using standard HTML elements with Tailwind classes since Button might not be exported correctly
interface ImageCaptureProps {
  label: string;
  imageSrc: string | undefined;
  onCapture: (src: string) => void;
  buttonId?: string;
}

const ImageCapture: React.FC<ImageCaptureProps> = ({ label, imageSrc, onCapture, buttonId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
      setIsOpen(false);
    }
  }, [webcamRef, onCapture]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      
      <div className="flex items-center gap-4">
        {/* Preview Area */}
        {imageSrc ? (
          <div className="relative w-32 h-20 border rounded-md overflow-hidden group">
            <img src={imageSrc} alt="Preview" className="w-full h-full object-cover" />
            <button 
              type="button"
              onClick={() => onCapture('')}
              className="absolute top-0 right-0 bg-red-600 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="w-32 h-20 border-2 border-dashed rounded-md flex items-center justify-center text-gray-400 bg-gray-50 text-xs">
            No Image
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <button id={buttonId} type="button" className="flex items-center justify-center px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent hover:text-accent-foreground">
                <Camera className="w-4 h-4 mr-2" /> Use Camera
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white p-6 rounded-lg">
              <div className="flex flex-col items-center gap-4">
                <h3 className="font-semibold text-lg">Capture Photo</h3>
                <div className="relative rounded-lg overflow-hidden border shadow-sm w-full">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="w-full h-64 object-cover"
                  />
                </div>
                <button 
                  onClick={capture} 
                  className="w-full py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700"
                >
                  Click Photo
                </button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="relative">
             <button 
                type="button" 
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium border rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                onClick={() => fileInputRef.current?.click()}
             >
                <Upload className="w-4 h-4 mr-2" /> Upload File
             </button>
             <input 
               ref={fileInputRef}
               type="file" 
               accept="image/*" 
               className="hidden" 
               onChange={handleFileUpload}
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCapture;