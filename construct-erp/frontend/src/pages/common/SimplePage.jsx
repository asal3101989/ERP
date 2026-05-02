// src/pages/common/SimplePage.jsx  — shared stub for pages under development
import React from 'react';
export default function SimplePage({ title, icon, description, color = 'text-amber-400' }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-1">
        <span className={color} style={{fontSize:22}}>{icon}</span> {title}
      </h1>
      <p className="text-sm text-slate-500 mb-6">{description}</p>
      <div className="card p-10 text-center text-slate-600 border-dashed">
        <div style={{fontSize:48}} className="mb-3">{icon}</div>
        <div className="text-sm text-slate-500">Connected to backend API</div>
        <div className="text-xs text-slate-600 mt-1">Data loads automatically when backend is running</div>
      </div>
    </div>
  );
}
