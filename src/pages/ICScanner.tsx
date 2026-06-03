import React, { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Camera, Download, RefreshCw, Check, X, Upload } from 'lucide-react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';

const ICScanner: React.FC = () => {
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardScale, setCardScale] = useState<number>(1.0);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [croppingSide, setCroppingSide] = useState<'front' | 'back' | null>(null);
  const [cropper, setCropper] = useState<any>();

  const frontCameraRef = useRef<HTMLInputElement>(null);
  const frontFileRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);
  const backFileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCroppingImage(event.target?.result as string);
        setCroppingSide(side);
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePDF = async () => {
    if (!frontImage || !backImage) return;
    setIsGenerating(true);
    
    try {
      const pdfDoc = await PDFDocument.create();
      // A4 dimensions are 595.28 x 841.89 (points)
      const page = pdfDoc.addPage([595.28, 841.89]);
      
      const embedImage = async (dataUrl: string) => {
        const isPng = dataUrl.startsWith('data:image/png');
        const isJpeg = dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg');
        
        let imageBytes;
        try {
          const res = await fetch(dataUrl);
          imageBytes = await res.arrayBuffer();
        } catch (e) {
          // Fallback for some browsers if fetch data url fails
          const base64Data = dataUrl.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          imageBytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              imageBytes[i] = binaryString.charCodeAt(i);
          }
        }

        if (isPng) return await pdfDoc.embedPng(imageBytes);
        if (isJpeg) return await pdfDoc.embedJpg(imageBytes);
        return null;
      };

      const frontPdfImage = await embedImage(frontImage);
      const backPdfImage = await embedImage(backImage);

      if (frontPdfImage && backPdfImage) {
        const targetWidth = 350 * cardScale;
        const targetHeight = targetWidth / 1.58;
        
        const centerX = (595.28 - targetWidth) / 2;
        const topMargin = 100;
        const gap = 50;
        
        // Draw front image at top
        page.drawImage(frontPdfImage, {
          x: centerX,
          y: 841.89 - topMargin - targetHeight,
          width: targetWidth,
          height: targetHeight,
        });
        
        // Draw back image below
        page.drawImage(backPdfImage, {
          x: centerX,
          y: 841.89 - topMargin - (targetHeight * 2) - gap,
          width: targetWidth,
          height: targetHeight,
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ID_Card.pdf';
        link.click();
        
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Make sure your images are valid JPEG or PNG.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setFrontImage(null);
    setBackImage(null);
    setCardScale(1.0);
  };

  const UploadBox = ({ title, image, onCamera, onFile }: { title: string, image: string | null, onCamera: () => void, onFile: () => void }) => (
    <div className={`glass-panel p-4 flex flex-col items-center justify-center transition-all border-2 border-dashed ${image ? 'border-primary/50' : 'border-white/20'} h-48 relative overflow-hidden`}>
      {image ? (
        <>
          <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-80" />
          <div className="absolute bottom-2 right-2 flex space-x-2 bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10">
            <button onClick={(e) => { e.stopPropagation(); onCamera(); }} className="p-1.5 hover:text-primary transition-colors text-white" title="Retake Photo"><Camera size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); onFile(); }} className="p-1.5 hover:text-primary transition-colors text-white" title="Reupload Image"><Upload size={16} /></button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium mb-4">{title}</p>
          <div className="flex space-x-4">
            <button onClick={(e) => { e.stopPropagation(); onCamera(); }} className="flex flex-col items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/10">
              <Camera className="text-primary mb-2" size={24} />
              <span className="text-xs font-medium">Camera</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onFile(); }} className="flex flex-col items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/10">
              <Upload className="text-primary mb-2" size={24} />
              <span className="text-xs font-medium">Upload</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">IC Combiner</h2>
        {(frontImage || backImage) && (
          <button onClick={reset} className="text-xs text-muted hover:text-white transition-colors">
            Reset All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Front Inputs */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          ref={frontCameraRef} 
          className="hidden" 
          onChange={(e) => handleImageUpload(e, 'front')} 
        />
        <input 
          type="file" 
          accept="image/*" 
          ref={frontFileRef} 
          className="hidden" 
          onChange={(e) => handleImageUpload(e, 'front')} 
        />
        <UploadBox 
          title="Front Side" 
          image={frontImage} 
          onCamera={() => {
            if (frontCameraRef.current) frontCameraRef.current.value = '';
            frontCameraRef.current?.click();
          }}
          onFile={() => {
            if (frontFileRef.current) frontFileRef.current.value = '';
            frontFileRef.current?.click();
          }}
        />

        {/* Back Inputs */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          ref={backCameraRef} 
          className="hidden" 
          onChange={(e) => handleImageUpload(e, 'back')} 
        />
        <input 
          type="file" 
          accept="image/*" 
          ref={backFileRef} 
          className="hidden" 
          onChange={(e) => handleImageUpload(e, 'back')} 
        />
        <UploadBox 
          title="Back Side" 
          image={backImage} 
          onCamera={() => {
            if (backCameraRef.current) backCameraRef.current.value = '';
            backCameraRef.current?.click();
          }}
          onFile={() => {
            if (backFileRef.current) backFileRef.current.value = '';
            backFileRef.current?.click();
          }}
        />
      </div>

      {(frontImage || backImage) && (
        <div className="glass-panel p-4 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-white/90">Card Print Size</label>
              <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded-md">
                {Math.round(cardScale * 100)}%
              </span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.05" 
              value={cardScale}
              onChange={(e) => setCardScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div className="mt-6">
            <p className="text-xs text-muted mb-2 text-center">Live A4 Print Preview</p>
            <div 
              className="w-full max-w-[240px] mx-auto bg-[#f8fafc] rounded shadow-2xl relative overflow-hidden ring-1 ring-white/10" 
              style={{ aspectRatio: '1 / 1.414' }}
            >
              {frontImage && (
                <img 
                  src={frontImage} 
                  className="absolute left-1/2 -translate-x-1/2 object-cover shadow-[0_4px_10px_rgba(0,0,0,0.1)] rounded-[2px]"
                  style={{ 
                    width: `${((350 * cardScale) / 595.28) * 100}%`, 
                    height: `${(((350 * cardScale) / 1.58) / 841.89) * 100}%`,
                    top: `${(100 / 841.89) * 100}%` 
                  }} 
                />
              )}
              {backImage && (
                <img 
                  src={backImage} 
                  className="absolute left-1/2 -translate-x-1/2 object-cover shadow-[0_4px_10px_rgba(0,0,0,0.1)] rounded-[2px]"
                  style={{ 
                    width: `${((350 * cardScale) / 595.28) * 100}%`, 
                    height: `${(((350 * cardScale) / 1.58) / 841.89) * 100}%`,
                    top: `${((100 + ((350 * cardScale) / 1.58) + 50) / 841.89) * 100}%` 
                  }} 
                />
              )}
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={generatePDF}
        disabled={!frontImage || !backImage || isGenerating}
        className="btn-primary w-full flex items-center justify-center space-x-2 py-4 text-lg"
      >
        {isGenerating ? (
          <RefreshCw className="animate-spin" />
        ) : (
          <Download />
        )}
        <span>{isGenerating ? 'Generating...' : 'Generate & Download PDF'}</span>
      </button>

      <p className="text-xs text-center text-muted">
        All processing is done locally on your device. No images are uploaded to any server.
      </p>

      {croppingImage && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-fade-in">
          <div className="flex-1 relative bg-black/80 flex flex-col">
            <h3 className="text-center py-4 font-semibold">Adjust Crop Area</h3>
            <div className="flex-1 overflow-hidden">
              <Cropper
                src={croppingImage}
                style={{ height: '100%', width: '100%' }}
                initialAspectRatio={1.586}
                guides={true}
                viewMode={1}
                autoCropArea={0.9}
                background={false}
                responsive={true}
                onInitialized={(instance) => setCropper(instance)}
              />
            </div>
          </div>
          <div className="p-6 bg-surface flex space-x-4 pb-12">
            <button 
              onClick={() => {
                setCroppingImage(null);
                setCroppingSide(null);
              }}
              className="btn-secondary flex-1 flex items-center justify-center space-x-2 py-4"
            >
              <X size={20} />
              <span>Cancel</span>
            </button>
            <button 
              onClick={() => {
                if (cropper) {
                  const cropped = cropper.getCroppedCanvas().toDataURL('image/jpeg', 0.9);
                  if (croppingSide === 'front') setFrontImage(cropped);
                  else setBackImage(cropped);
                  setCroppingImage(null);
                  setCroppingSide(null);
                }
              }}
              className="btn-primary flex-1 flex items-center justify-center space-x-2 py-4"
            >
              <Check size={20} />
              <span>Save Crop</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ICScanner;
