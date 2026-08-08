import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db } from '../db';
import { FileUp, Download, Trash2, Plus, Type, Image as ImageIcon, ChevronLeft, ChevronRight, X, FileSignature, ZoomIn, ZoomOut } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Set up worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PDFItem = {
  id: string;
  type: 'text' | 'signature';
  pageIndex: number;
  x: number;
  y: number;
  content: string; // text string or image dataURL
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  itemScale?: number;
};

const PDFEditor = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [items, setItems] = useState<PDFItem[]>([]);
  const [scale, setScale] = useState<number>(1);
  
  // Tabs for tools
  const [activeTab, setActiveTab] = useState<'text' | 'signatures'>('text');
  
  // New Text State
  const [newText, setNewText] = useState('');
  const [newTextFont, setNewTextFont] = useState('Helvetica');
  const [newTextSize, setNewTextSize] = useState(14);
  const [newTextColor, setNewTextColor] = useState('#000000');

  const savedTexts = useLiveQuery(() => db.pdfTexts.toArray()) || [];
  const savedSignatures = useLiveQuery(() => db.pdfSignatures.toArray()) || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
      setPageNumber(1);
      setItems([]);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        await db.pdfSignatures.add({
          name: file.name,
          imageBlob: reader.result as string,
          createdAt: Date.now()
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveTextSnippet = async () => {
    if (!newText.trim()) return;
    await db.pdfTexts.add({
      text: newText,
      fontFamily: newTextFont,
      fontSize: newTextSize,
      color: newTextColor,
      createdAt: Date.now()
    });
    setNewText('');
  };

  const addItemToPdf = (item: { text?: string; imageBlob?: string; fontFamily?: string; fontSize?: number; color?: string }, type: 'text' | 'signature') => {
    if (!pdfFile) return;
    
    // Find the center of the viewport for placement
    const container = containerRef.current;
    let placeY = 100;
    if (container) {
      placeY = container.scrollTop + 100;
    }

      const newItem: PDFItem = {
      id: crypto.randomUUID(),
      type,
      pageIndex: pageNumber,
      x: 50 / scale,
      y: placeY / scale,
      content: type === 'text' ? (item.text || '') : (item.imageBlob || ''),
      fontFamily: item.fontFamily,
      fontSize: item.fontSize,
      color: item.color,
      itemScale: 1
    };
    setItems([...items, newItem]);
  };

  // Dragging logic
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, scale: 1 });
  
  // Panning state
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    // Only pan if clicking directly on the pdf background, not on items or inputs
    if ((e.target as HTMLElement).closest('.pdf-item') || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).tagName === 'INPUT') {
      return;
    }
    
    if (containerRef.current) {
      setPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: containerRef.current.scrollLeft,
        scrollTop: containerRef.current.scrollTop
      });
      containerRef.current.style.cursor = 'grabbing';
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    // Check if clicking resize handle
    if ((e.target as HTMLElement).closest('.resize-handle')) {
      const item = items.find(i => i.id === id);
      if (item) {
        setResizeStart({ x: e.clientX, scale: item.itemScale || 1 });
        setResizingId(id);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }
    
    // Normal drag
    const el = (e.target as HTMLElement).closest('.pdf-item') as HTMLElement;
    if (el && pdfWrapperRef.current) {
      const rect = el.getBoundingClientRect();
      // Calculate offset based on the PDF wrapper's relative position
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setDraggingId(id);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (panning && containerRef.current) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      containerRef.current.scrollLeft = panStart.scrollLeft - dx;
      containerRef.current.scrollTop = panStart.scrollTop - dy;
      return;
    }

    if (resizingId) {
      // Handle resizing
      const deltaX = (e.clientX - resizeStart.x) / scale; // Adjust for pdf scale
      // roughly 100px = 1 scale unit
      const newScale = Math.max(0.2, resizeStart.scale + (deltaX / 100));
      setItems(items.map(item => 
        item.id === resizingId 
          ? { ...item, itemScale: newScale }
          : item
      ));
      return;
    }

    if (draggingId && pdfWrapperRef.current) {
      const wrapperRect = pdfWrapperRef.current.getBoundingClientRect();
      const newX = (e.clientX - wrapperRect.left - dragOffset.x) / scale;
      const newY = (e.clientY - wrapperRect.top - dragOffset.y) / scale;
      
      setItems(items.map(item => 
        item.id === draggingId 
          ? { ...item, x: newX, y: newY }
          : item
      ));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (panning) {
      setPanning(false);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) { void err; }
      return;
    }

    if (draggingId || resizingId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {
        void err;
      }
      setDraggingId(null);
      setResizingId(null);
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
  };

  const downloadPdf = async () => {
    if (!pdfFile || !pdfWrapperRef.current) return;
    
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    const canvas = pdfWrapperRef.current.querySelector('canvas');
    if (!canvas) return;
    const renderedWidth = canvas.clientWidth;
    const renderedHeight = canvas.clientHeight;

    const pages = pdfDoc.getPages();
    
    for (const item of items) {
      const page = pages[item.pageIndex - 1];
      const { width, height } = page.getSize();
      
      const scaleX = width / renderedWidth;
      const scaleY = height / renderedHeight;
      
      const pdfX = (item.x * scale) * scaleX;
      // Convert y from top-left to bottom-left origin
      const pdfY = height - ((item.y * scale) * scaleY);
      
      const currentItemScale = item.itemScale || 1;
      
      if (item.type === 'text') {
        let font;
        if (item.fontFamily === 'TimesRoman') font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        else if (item.fontFamily === 'Courier') font = await pdfDoc.embedFont(StandardFonts.Courier);
        else font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        const color = hexToRgb(item.color || '#000000');
        const baseFontSize = (item.fontSize || 14) * currentItemScale;
        const pdfFontSize = baseFontSize * scaleY;
        
        page.drawText(item.content, {
          x: pdfX,
          y: pdfY - pdfFontSize,
          size: pdfFontSize,
          font: font,
          color: rgb(color.r, color.g, color.b),
        });
      } else if (item.type === 'signature') {
        let img;
        if (item.content.startsWith('data:image/png')) {
          img = await pdfDoc.embedPng(item.content);
        } else if (item.content.startsWith('data:image/jpeg') || item.content.startsWith('data:image/jpg')) {
          img = await pdfDoc.embedJpg(item.content);
        }
        
        if (img) {
          // Use the internal state scale multiplied by our base bounds
          const baseImgWidth = 120 * currentItemScale;
          // Calculate proportional height based on actual image dimensions
          const imgDims = img.scale(1);
          const ratio = imgDims.height / imgDims.width;
          const baseImgHeight = baseImgWidth * ratio;
          
          page.drawImage(img, {
            x: pdfX,
            y: pdfY - (baseImgHeight * scaleY),
            width: baseImgWidth * scaleX,
            height: baseImgHeight * scaleY
          });
        }
      }
    }
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const hasSignature = items.some(item => item.type === 'signature');
    const prefix = hasSignature ? 'signed_' : 'edited_';
    link.download = `${prefix}${pdfFile.name}`;
    
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/20 text-blue-500 rounded-xl">
            <FileSignature size={24} />
          </div>
          <h2 className="text-2xl font-bold">PDF Editor</h2>
        </div>
      </div>

      {!pdfFile ? (
        <div className="glass-panel p-8 flex flex-col items-center justify-center text-center border-dashed border-text/20 py-16">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
            <FileUp className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">Muat Naik Dokumen</h3>
          <p className="text-sm text-muted mb-8 max-w-[250px]">
            Tambah tandatangan dan teks pada mana-mana PDF terus dalam pelayar anda.
          </p>
          <label className="px-8 py-3 bg-primary text-white font-bold rounded-2xl cursor-pointer hover:scale-105 transition-transform shadow-lg shadow-primary/30">
            Pilih Fail PDF
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main PDF Viewer */}
          <div className="glass-panel border-text/10 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-text/5 bg-surface/50">
              <span className="text-sm font-bold text-text truncate max-w-[150px]">
                {pdfFile.name}
              </span>
              <div className="flex items-center gap-1 bg-background rounded-lg p-1 border border-text/5">
                <button 
                  onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                  disabled={pageNumber <= 1}
                  className="p-1 hover:bg-text/5 rounded-md text-text disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold w-12 text-center text-muted">
                  {pageNumber} / {numPages || '-'}
                </span>
                <button 
                  onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                  disabled={pageNumber >= numPages}
                  className="p-1 hover:bg-text/5 rounded-md text-text disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex items-center gap-1 bg-background rounded-lg p-1 border border-text/5">
                <button 
                  onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                  className="p-1 hover:bg-text/5 rounded-md text-text transition-colors"
                  title="Zum Keluar"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-bold w-12 text-center text-muted">
                  {Math.round(scale * 100)}%
                </span>
                <button 
                  onClick={() => setScale(Math.min(3, scale + 0.25))}
                  className="p-1 hover:bg-text/5 rounded-md text-text transition-colors"
                  title="Zum Masuk"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
              <button
                onClick={() => setPdfFile(null)}
                className="p-1.5 text-muted hover:text-rose-500 bg-background rounded-lg border border-text/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Document Workspace */}
            <div 
              ref={containerRef}
              className="relative overflow-auto max-h-[60vh] bg-black/5 p-4 text-center cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }} // Disable browser pull-to-refresh / native touch scroll to allow our custom pan
              onPointerDown={handleContainerPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <div 
                ref={pdfWrapperRef}
                className="relative shadow-xl bg-white select-none transition-shadow inline-block text-left"
              >
                <Document
                  file={pdfFile}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={<div className="p-8 text-muted font-medium">Memuatkan dokumen...</div>}
                >
                  <Page 
                    pageNumber={pageNumber} 
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    scale={scale}
                    width={typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 800) : 400}
                  />
                </Document>

                {/* Overlaid Items */}
                {items.filter(item => item.pageIndex === pageNumber).map(item => {
                  const currentItemScale = item.itemScale || 1;
                  return (
                  <div
                    key={item.id}
                    className="pdf-item absolute group hover:ring-2 hover:ring-primary/50 hover:bg-primary/5 p-1 -m-1 rounded transition-colors"
                    style={{
                      left: item.x * scale,
                      top: item.y * scale,
                      touchAction: 'none',
                      zIndex: (draggingId === item.id || resizingId === item.id) ? 50 : 10,
                      cursor: resizingId === item.id ? 'nwse-resize' : 'move'
                    }}
                    onPointerDown={(e) => handlePointerDown(e, item.id)}
                  >
                    {item.type === 'text' ? (
                      <span 
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newText = e.target.textContent;
                          if (newText) {
                            setItems(items.map(i => i.id === item.id ? { ...i, content: newText } : i));
                          }
                        }}
                        onPointerDown={(e) => {
                          // Allow cursor selection if already focused
                          if (document.activeElement === e.target) {
                            e.stopPropagation();
                          }
                        }}
                        style={{ 
                          fontFamily: item.fontFamily, 
                          fontSize: `${(item.fontSize || 14) * scale * currentItemScale}px`, 
                          color: item.color,
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                          outline: 'none',
                          minWidth: '20px',
                          display: 'inline-block'
                        }}
                      >
                        {item.content}
                      </span>
                    ) : (
                      <img 
                        src={item.content} 
                        alt="Tandatangan" 
                        style={{ width: `${120 * scale * currentItemScale}px`, height: 'auto' }}
                        draggable={false}
                        className="pointer-events-none" 
                      />
                    )}
                    
                    {/* Delete Button */}
                    <button
                      className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20 hover:scale-110"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setItems(items.filter(i => i.id !== item.id));
                      }}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                    
                    {/* Resize Handle */}
                    <div 
                      className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-primary border border-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20 cursor-nwse-resize"
                      title="Seret untuk ubah saiz"
                    />
                  </div>
                )})}
              </div>
            </div>

            <div className="p-3 bg-surface/50 border-t border-text/5 flex justify-end">
              <button
                onClick={downloadPdf}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-transform active:scale-95 shadow-md shadow-primary/20"
              >
                <Download size={16} /> Simpan & Muat Turun
              </button>
            </div>
          </div>

          {/* Tools Area */}
          <div className="glass-panel p-4 border-text/10">
            <div className="flex space-x-2 p-1 bg-background rounded-xl shadow-inner border border-text/5 mb-4">
              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'text' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
              >
                <Type size={16} /> Tambah Teks
              </button>
              <button
                onClick={() => setActiveTab('signatures')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'signatures' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
              >
                <ImageIcon size={16} /> Tambah Tandatangan
              </button>
            </div>

            {activeTab === 'text' && (
              <div className="space-y-4">
                <div className="bg-surface/50 p-4 rounded-xl border border-text/5 space-y-3">
                  <input
                    type="text"
                    placeholder="Masukkan teks baru..."
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    className="w-full bg-background border border-text/10 rounded-xl px-4 py-3 text-sm font-medium text-text focus:outline-none focus:border-primary transition-colors"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newTextFont}
                      onChange={(e) => setNewTextFont(e.target.value)}
                      className="flex-1 bg-background border border-text/10 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:border-primary"
                    >
                      <option value="Helvetica">Helvetica</option>
                      <option value="TimesRoman">Times Roman</option>
                      <option value="Courier">Courier</option>
                    </select>
                    <input
                      type="number"
                      value={newTextSize}
                      onChange={(e) => setNewTextSize(Number(e.target.value))}
                      className="w-20 bg-background border border-text/10 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:border-primary"
                      min="8" max="72"
                    />
                    <input
                      type="color"
                      value={newTextColor}
                      onChange={(e) => setNewTextColor(e.target.value)}
                      className="w-10 h-10 p-0 border-0 rounded-lg cursor-pointer bg-background shrink-0"
                    />
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (newText.trim()) {
                            addItemToPdf({ text: newText, fontFamily: newTextFont, fontSize: newTextSize, color: newTextColor }, 'text');
                            setNewText('');
                          }
                        }}
                        disabled={!newText.trim()}
                        className="px-4 py-1.5 bg-primary text-white disabled:opacity-50 hover:bg-primary/90 rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        Masukkan
                      </button>
                      <button
                        onClick={saveTextSnippet}
                        disabled={!newText.trim()}
                        className="px-4 py-1.5 bg-surface border border-text/10 text-text disabled:opacity-50 hover:bg-text/5 rounded-lg text-xs font-bold transition-colors"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-muted uppercase tracking-wider pl-1">Teks Disimpan</h3>
                  {savedTexts.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-text/20 rounded-xl">
                      <p className="text-sm text-muted font-medium">Tiada teks disimpan.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {savedTexts.map(text => (
                        <div key={text.id} className="flex items-center justify-between p-3 bg-surface border border-text/5 rounded-xl">
                          <div className="truncate flex-1 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: text.color || '#000000' }} title={`Warna: ${text.color}`} />
                            <span 
                              className="text-text" 
                              style={{ fontFamily: text.fontFamily, fontSize: '14px' }}
                            >
                              {text.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => addItemToPdf(text, 'text')}
                              className="p-1.5 text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
                            >
                              <Plus size={14} /> Masukkan
                            </button>
                            <button
                              onClick={() => text.id && db.pdfTexts.delete(text.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'signatures' && (
              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-text/20 rounded-xl cursor-pointer bg-surface hover:bg-surface/80 transition-colors">
                  <div className="flex items-center justify-center gap-2">
                    <FileUp className="w-5 h-5 text-muted" />
                    <p className="text-sm text-text font-bold">Muat naik tandatangan baru</p>
                  </div>
                  <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleSignatureUpload} />
                </label>

                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-muted uppercase tracking-wider pl-1">Tandatangan Disimpan</h3>
                  {savedSignatures.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-text/20 rounded-xl">
                      <p className="text-sm text-muted font-medium">Tiada tandatangan disimpan.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                      {savedSignatures.map(sig => (
                        <div key={sig.id} className="relative group border border-text/10 rounded-xl p-2 bg-surface overflow-hidden flex items-center justify-center min-h-[80px]">
                          <img src={sig.imageBlob} alt={sig.name} className="max-w-full max-h-16 object-contain" />
                          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => addItemToPdf(sig, 'signature')}
                              className="p-1.5 bg-blue-500 text-white rounded-lg hover:scale-105 transition-transform text-xs font-bold flex items-center gap-1"
                            >
                              <Plus size={14} /> Masukkan
                            </button>
                            <button
                              onClick={() => sig.id && db.pdfSignatures.delete(sig.id)}
                              className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFEditor;
