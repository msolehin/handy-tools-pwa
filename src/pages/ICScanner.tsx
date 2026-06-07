import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { Camera, Download, RefreshCw, Check, X, Upload, Settings2, Type, ChevronDown } from 'lucide-react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';

const ICScanner: React.FC = () => {
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardScale, setCardScale] = useState<number>(1.0);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [croppingSide, setCroppingSide] = useState<'front' | 'back' | null>(null);
  const cropperRef = useRef<any>(null);

  // Watermark States
  const [wmEnabled, setWmEnabled] = useState(false);
  const [wmText, setWmText] = useState('FOR PRIVATE USE ONLY');
  const [wmColor, setWmColor] = useState('#000000');
  const [wmSize, setWmSize] = useState(10);
  const [wmRotation, setWmRotation] = useState(-30);
  const [wmOpacity, setWmOpacity] = useState(1.0);
  const [wmThickness, setWmThickness] = useState(1);
  const [wmOffset, setWmOffset] = useState({ x: -15, y: 55 });

  const resetWmSettings = () => {
    setWmSize(10);
    setWmRotation(-30);
    setWmOpacity(1.0);
    setWmThickness(1);
    setWmOffset({ x: -15, y: 55 });
    setWmColor('#000000');
    setWmText('FOR PRIVATE USE ONLY');
  };
  const [showWmAdvanced, setShowWmAdvanced] = useState(false);

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

  const dragRef = useRef<{ startX: number, startY: number, initOffX: number, initOffY: number } | null>(null);

  const onWmPointerDown = (e: React.PointerEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initOffX: wmOffset.x,
      initOffY: wmOffset.y
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onWmPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    setWmOffset({
      x: dragRef.current.initOffX + (dx / rect.width) * 100,
      y: dragRef.current.initOffY + (dy / rect.height) * 100
    });
  };

  const onWmPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const WatermarkPreview = () => {
    if (!wmEnabled || !wmText) return null;
    const targetWidth = 350 * cardScale;
    const sizePct = (wmSize / targetWidth) * 100;
    const thickPct = (wmThickness / targetWidth) * 100;
    const padPct = sizePct * 0.4;
    return (
      <div 
        className="absolute flex flex-col items-center justify-center cursor-move touch-none z-20"
        onPointerDown={onWmPointerDown}
        onPointerMove={onWmPointerMove}
        onPointerUp={onWmPointerUp}
        onPointerCancel={onWmPointerUp}
        style={{
          left: `${wmOffset.x}%`,
          top: `${wmOffset.y}%`,
          transform: `translate(0, -100%) rotate(${wmRotation}deg)`,
          transformOrigin: 'bottom left',
          opacity: wmOpacity,
          color: wmColor
        }}
      >
        <div style={{ height: `${thickPct}cqw`, backgroundColor: wmColor, width: '100%', marginBottom: `${padPct}cqw` }}></div>
        <div style={{ fontSize: `${sizePct}cqw`, fontWeight: 'bold', whiteSpace: 'nowrap', lineHeight: 1 }}>{wmText}</div>
        <div style={{ height: `${thickPct}cqw`, backgroundColor: wmColor, width: '100%', marginTop: `${padPct}cqw` }}></div>
      </div>
    );
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
        const frontY = 841.89 - topMargin - targetHeight;
        page.drawImage(frontPdfImage, {
          x: centerX,
          y: frontY,
          width: targetWidth,
          height: targetHeight,
        });
        
        // Draw back image below
        const backY = 841.89 - topMargin - (targetHeight * 2) - gap;
        page.drawImage(backPdfImage, {
          x: centerX,
          y: backY,
          width: targetWidth,
          height: targetHeight,
        });

        // Add Watermark if enabled
        if (wmEnabled && wmText) {
          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const colorResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(wmColor);
          const color = colorResult ? {
            r: parseInt(colorResult[1], 16) / 255,
            g: parseInt(colorResult[2], 16) / 255,
            b: parseInt(colorResult[3], 16) / 255
          } : { r: 0, g: 0, b: 0 };
          const pdfColor = rgb(color.r, color.g, color.b);
          
          const drawWm = (imageY: number) => {
            const startX = centerX + (targetWidth * (wmOffset.x / 100));
            const startY = (imageY + targetHeight) - (targetHeight * (wmOffset.y / 100));
            const angle = degrees(-wmRotation);
            const textWidth = font.widthOfTextAtSize(wmText, wmSize);
            const textHeight = font.heightAtSize(wmSize);

            page.drawText(wmText, {
              x: startX,
              y: startY,
              size: wmSize,
              font: font,
              color: pdfColor,
              opacity: wmOpacity,
              rotate: angle
            });

            const rad = (-wmRotation * Math.PI) / 180;
            const padding = wmSize * 0.4;

            const drawRotatedLine = (x1: number, y1: number, x2: number, y2: number) => {
              const rx1 = x1 * Math.cos(rad) - y1 * Math.sin(rad);
              const ry1 = x1 * Math.sin(rad) + y1 * Math.cos(rad);
              const rx2 = x2 * Math.cos(rad) - y2 * Math.sin(rad);
              const ry2 = x2 * Math.sin(rad) + y2 * Math.cos(rad);
              
              page.drawLine({
                start: { x: startX + rx1, y: startY + ry1 },
                end: { x: startX + rx2, y: startY + ry2 },
                thickness: wmThickness,
                color: pdfColor,
                opacity: wmOpacity
              });
            };

            drawRotatedLine(-padding, textHeight + padding, textWidth + padding, textHeight + padding);
            drawRotatedLine(-padding, -padding * 1.5, textWidth + padding, -padding * 1.5);
          };

          drawWm(frontY);
          drawWm(backY);
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `ID_Card_${timestamp}.pdf`;
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
    <div className={`glass-panel p-4 flex flex-col items-center justify-center transition-all border-2 border-dashed ${image ? 'border-primary/50' : 'border-text/20'} h-48 relative overflow-hidden`}>
      {image ? (
        <>
          <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover opacity-80" />
          <div className="absolute bottom-2 right-2 flex space-x-2 bg-black/60 p-2 rounded-lg backdrop-blur-sm z-10">
            <button onClick={(e) => { e.stopPropagation(); onCamera(); }} className="p-1.5 hover:text-primary transition-colors text-text" title="Retake Photo"><Camera size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); onFile(); }} className="p-1.5 hover:text-primary transition-colors text-text" title="Reupload Image"><Upload size={16} /></button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium mb-4">{title}</p>
          <div className="flex space-x-4">
            <button onClick={(e) => { e.stopPropagation(); onCamera(); }} className="flex flex-col items-center p-3 bg-text/5 rounded-xl hover:bg-text/10 transition-colors border border-text/10">
              <Camera className="text-primary mb-2" size={24} />
              <span className="text-xs font-medium">Camera</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onFile(); }} className="flex flex-col items-center p-3 bg-text/5 rounded-xl hover:bg-text/10 transition-colors border border-text/10">
              <Upload className="text-primary mb-2" size={24} />
              <span className="text-xs font-medium">Insert Image</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">IC Palang</h2>
        {(frontImage || backImage) && (
          <button onClick={reset} className="text-xs text-muted hover:text-text transition-colors">
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
              <label className="text-sm font-medium text-text/90">Card Print Size</label>
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
              className="w-full max-w-[240px] mx-auto bg-[#f8fafc] rounded shadow-2xl relative overflow-hidden ring-1 ring-text/10 touch-none" 
              style={{ aspectRatio: '1 / 1.414' }}
            >
              {frontImage && (
                <div 
                  className="absolute left-1/2 -translate-x-1/2 rounded-[2px]"
                  style={{ 
                    width: `${((350 * cardScale) / 595.28) * 100}%`, 
                    height: `${(((350 * cardScale) / 1.58) / 841.89) * 100}%`,
                    top: `${(100 / 841.89) * 100}%`,
                    containerType: 'inline-size'
                  }} 
                >
                  <img src={frontImage} className="w-full h-full object-cover shadow-[0_4px_10px_rgba(0,0,0,0.1)]" />
                  <WatermarkPreview />
                </div>
              )}
              {backImage && (
                <div 
                  className="absolute left-1/2 -translate-x-1/2 rounded-[2px]"
                  style={{ 
                    width: `${((350 * cardScale) / 595.28) * 100}%`, 
                    height: `${(((350 * cardScale) / 1.58) / 841.89) * 100}%`,
                    top: `${((100 + ((350 * cardScale) / 1.58) + 50) / 841.89) * 100}%`,
                    containerType: 'inline-size'
                  }} 
                >
                  <img src={backImage} className="w-full h-full object-cover shadow-[0_4px_10px_rgba(0,0,0,0.1)]" />
                  <WatermarkPreview />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Watermark UI */}
      <div className="glass-panel p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Type className="text-primary" size={18} />
            <h3 className="font-semibold text-text/90">Add Watermark (Palang)</h3>
          </div>
          <button 
            onClick={() => setWmEnabled(!wmEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${wmEnabled ? 'bg-primary' : 'bg-text/10'}`}
          >
            <div className={`w-5 h-5 bg-text rounded-full absolute top-0.5 transition-transform ${wmEnabled ? 'left-6 translate-x-0.5' : 'left-0.5'}`} />
          </button>
        </div>

        {wmEnabled && (
          <div className="space-y-4 animate-slide-up mt-4 pt-4 border-t border-text/10">
            <div>
              <label className="block text-sm text-muted mb-2">Watermark Text</label>
              <input 
                type="text" 
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                className="input-field w-full"
                placeholder="e.g. FOR PRIVATE USE ONLY"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {['FOR PRIVATE USE ONLY', 'FOR BANK USE ONLY', 'FOR LOAN APPLICATION'].map(t => (
                  <button key={t} onClick={() => setWmText(t)} className="text-[10px] bg-text/5 hover:bg-text/10 px-2 py-1 rounded">
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-muted">Color</label>
              <div className="flex space-x-2">
                {['#000000', '#EF4444', '#3B82F6', '#10B981', '#ffffff'].map(c => (
                  <button 
                    key={c} 
                    onClick={() => setWmColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${wmColor === c ? 'border-primary scale-110' : 'border-text/20'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={() => setShowWmAdvanced(!showWmAdvanced)}
                className="flex items-center text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Settings2 size={14} className="mr-1" />
                <span>Advanced Settings</span>
                <ChevronDown size={14} className={`ml-1 transition-transform ${showWmAdvanced ? 'rotate-180' : ''}`} />
              </button>
              
              <button onClick={resetWmSettings} className="text-[10px] text-muted hover:text-text transition-colors underline">
                Reset Position & Settings
              </button>
            </div>
              
              {showWmAdvanced && (
                <div className="grid grid-cols-2 gap-4 mt-4 bg-black/20 p-3 rounded-xl border border-text/5">
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Size ({wmSize}px)</label>
                    <input type="range" min="5" max="14" value={wmSize} onChange={(e) => setWmSize(parseInt(e.target.value))} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Rotation ({wmRotation}°)</label>
                    <input type="range" min="-90" max="90" value={wmRotation} onChange={(e) => setWmRotation(parseInt(e.target.value))} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Opacity ({Math.round(wmOpacity * 100)}%)</label>
                    <input type="range" min="0.1" max="1.0" step="0.1" value={wmOpacity} onChange={(e) => setWmOpacity(parseFloat(e.target.value))} className="w-full accent-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted mb-1">Thickness ({wmThickness}px)</label>
                    <input type="range" min="1" max="4" value={wmThickness} onChange={(e) => setWmThickness(parseInt(e.target.value))} className="w-full accent-primary" />
                  </div>
                </div>
              )}
            <p className="text-[10px] text-muted italic">Tip: You can drag the watermark directly on the preview above to move it!</p>
          </div>
        )}
      </div>

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

      {croppingImage && createPortal(
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-fade-in">
          <div className="flex-1 min-h-0 relative bg-black/80 flex flex-col">
            <h3 className="text-center py-4 font-semibold text-text">Adjust Crop Area</h3>
            <div className="flex-1 min-h-0 overflow-hidden">
              <Cropper
                src={croppingImage}
                style={{ height: '100%', width: '100%' }}
                initialAspectRatio={1.586}
                guides={true}
                viewMode={1}
                autoCropArea={0.9}
                background={false}
                responsive={true}
                ref={cropperRef}
              />
            </div>
          </div>
          <div className="p-6 bg-surface flex space-x-4 pb-12 shrink-0">
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
                const cropper = cropperRef.current?.cropper;
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
      , document.body)}

    </div>
  );
};

export default ICScanner;
