import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function TableActions({ 
  onEdit, 
  onDelete, 
  disableEdit = false, 
  recordName = "this record",
  extraActions = [] 
}) {
  const { isAdmin } = useAuthStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const canDelete = Boolean(onDelete) && isAdmin();

  const confirmDelete = (e) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const cancelDelete = (e) => {
    e.stopPropagation();
    setShowConfirm(false);
  };

  const executeDelete = (e) => {
    e.stopPropagation();
    setShowConfirm(false);
    if (onDelete && typeof onDelete === 'function') {
      onDelete();
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Delete?</span>
        <button onClick={executeDelete} className="text-[10px] px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500 font-bold shadow-lg shadow-red-900/20">Yes</button>
        <button onClick={cancelDelete} className="text-[10px] px-2 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 font-bold">No</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2 transition-opacity">
      {extraActions.map((action, idx) => (
        <button
          key={idx}
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          className={clsx(
            "p-1.5 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors",
            action.className || "text-slate-500 hover:text-white"
          )}
          title={action.title}
        >
          {action.icon}
        </button>
      ))}

      {onEdit && !disableEdit && (
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(); }} 
          className="text-slate-500 hover:text-blue-400 p-1.5 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
      )}
      
      {canDelete && (
        <button 
          onClick={confirmDelete}
          className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded border border-red-200 transition-colors shadow-sm"
          title="Delete vendor"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
}

import { clsx } from 'clsx';
