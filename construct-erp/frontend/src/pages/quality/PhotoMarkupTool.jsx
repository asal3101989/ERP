// src/pages/quality/PhotoMarkupTool.jsx
import React, { useRef, useEffect, useState } from 'react';
import { 
  X, RotateCcw, Save, Trash2, 
  Type, MoveUpRight, Circle, MousePointer2,
  Square, Pen, Palette
} from 'lucide-react';
import { clsx } from 'clsx';

export default function PhotoMarkupTool({ imageUrl, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen'); // pen, arrow, circle, text
  const [color, setColor] = useState('#EF4444'); // Red default
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  
  // Initialize canvas with image
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      // Scale canvas to image (keeping it manageable)
      const maxWidth = 1000;
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      saveState();
    };
  }, [imageUrl]);

  const saveState = () => {
    const canvas = canvasRef.current;
    setHistory(prev => [...prev, canvas.toDataURL()]);
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    setHistory(newHistory);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const prevState = newHistory[newHistory.length - 1];
    const img = new Image();
    img.src = prevState;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    const pos = getMousePos(e);
    setStartPos(pos);
    setIsDrawing(true);
    
    if (tool === 'text') {
      const text = prompt('Enter annotation text:');
      if (text) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.font = '24px DM Sans';
        ctx.fillStyle = color;
        ctx.fillText(text, pos.x, pos.y);
        saveState();
      }
      setIsDrawing(false);
    }
  };

  const draw = (e) => {
    if (!isDrawing || tool === 'text') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getMousePos(e);
    
    // For shape tools, we need to clear and redraw from previous state to show preview
    if (tool !== 'pen') {
       const prevState = history[history.length - 1];
       const img = new Image();
       img.src = prevState;
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       ctx.drawImage(img, 0, 0);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (tool === 'pen') {
       ctx.lineTo(pos.x, pos.y);
       ctx.stroke();
    } else if (tool === 'arrow') {
       drawArrow(ctx, startPos.x, startPos.y, pos.x, pos.y);
    } else if (tool === 'circle') {
       const radius = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
       ctx.beginPath();
       ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
       ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
       saveState();
       setIsDrawing(false);
       const canvas = canvasRef.current;
       canvas.getContext('2d').beginPath(); // reset path
    }
  };

  const drawArrow = (ctx, fromx, fromy, tox, toy) => {
    const headlen = 15;
    const angle = Math.atan2(toy - fromy, tox - fromx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[150] flex flex-col items-center p-6 space-y-6">
       {/* Top Bar */}
       <div className="w-full max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-black/20 text-blue-700">
                <Pen size={22} />
             </div>
             <div>
                <h3 className="text-xl font-black text-white uppercase italic leading-none mb-1">Forensic Defect Markup</h3>
                <p className="text-[10px] font-black text-blue-200/60 uppercase tracking-widest leading-none">High-Integrity Quality Evidence Capture • V3.0</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={undo} className="px-6 py-3 bg-white/10 text-white hover:bg-white/20 border border-white/10 rounded-2xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                <RotateCcw size={14} className="text-blue-300" /> Undo Action
             </button>
             <button onClick={onCancel} className="w-12 h-12 flex items-center justify-center bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-2xl transition-all">
                <X size={20} />
             </button>
          </div>
       </div>

       {/* Editor Workspace */}
       <div className="flex-1 w-full max-w-6xl bg-gradient-to-b from-[#1E40AF] to-[#172554] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative">
          
          {/* Vertical Toolbar (Glass) */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 p-3 bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/10 z-10 shadow-2xl">
             {[
               { id: 'pen', icon: Pen, label: 'Free Draw' },
               { id: 'arrow', icon: MoveUpRight, label: 'Arrow Markup' },
               { id: 'circle', icon: Circle, label: 'Highlight Area' },
               { id: 'text', icon: Type, label: 'Text Comment' }
             ].map(t => (
               <button 
                key={t.id}
                onClick={() => setTool(t.id)}
                className={clsx(
                  "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300", 
                  tool === t.id ? "bg-white text-blue-700 shadow-xl" : "text-blue-100/40 hover:text-white hover:bg-white/10"
                )}
                title={t.label}
               >
                 <t.icon size={20} />
               </button>
             ))}
             
             <div className="w-10 h-[1px] bg-white/10 mx-auto my-1" />
             
             {[
               { id: 'red', val: '#EF4444' },
               { id: 'emerald', val: '#10B981' },
               { id: 'blue', val: '#FFFFFF' },
               { id: 'amber', val: '#F59E0B' }
             ].map(c => (
               <button 
                key={c.id} 
                onClick={() => setColor(c.val)}
                className={clsx(
                  "w-8 h-8 rounded-full border-2 transition-all mx-auto", 
                  color === c.val ? "border-white scale-110 shadow-lg ring-4 ring-white/10" : "border-transparent opacity-40 hover:opacity-80"
                )}
                style={{ backgroundColor: c.val }}
               />
             ))}
          </div>

          {/* Canvas Area */}
          <div className="flex-1 flex items-center justify-center p-12 overflow-hidden">
             <div className="relative p-2 bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-sm">
                <canvas 
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseOut={stopDrawing}
                  className="bg-black/20 shadow-2xl rounded-lg cursor-crosshair border border-white/5 max-w-full"
                />
             </div>
          </div>

          {/* Bottom Action Bar (Glass) */}
          <div className="p-8 border-t border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-md">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                     <Palette size={14} className="text-blue-300" />
                   </div>
                   <div>
                     <p className="text-[10px] font-black text-blue-200/40 uppercase tracking-widest leading-none mb-1">Active Tool</p>
                     <p className="text-xs font-black text-white uppercase italic leading-none">{tool === 'pen' ? 'Precision Pen' : tool.toUpperCase()}</p>
                   </div>
                </div>
                <div className="w-[1px] h-8 bg-white/10" />
                <p className="text-[10px] font-black text-blue-200/30 uppercase italic tracking-widest leading-relaxed max-w-[200px]">
                  High Sensitivity Forensic Markup Engine • v.09-Audit Ready
                </p>
             </div>
             <button 
                onClick={() => onSave(canvasRef.current.toDataURL())}
                className="btn-primary py-5 px-12 bg-white text-blue-700 hover:bg-blue-50 text-[10px] font-black uppercase tracking-[0.2em] italic shadow-2xl shadow-black/20 flex items-center gap-3 rounded-2xl transition-all"
             >
                <Save size={16} /> Certify Markup & Authorize 🛡
             </button>
          </div>
       </div>
    </div>
  );
}
