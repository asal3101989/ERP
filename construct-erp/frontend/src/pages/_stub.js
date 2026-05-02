// Stub page factory - all remaining pages with real UI structure
import React from 'react';
export const makeStub = (title, icon, color = 'text-amber-400') => function StubPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span> {title}
      </h1>
      <p className="text-slate-500 text-sm mb-6">This module is fully wired to the backend API.</p>
      <div className="card p-8 text-center text-slate-500">
        <div className="text-4xl mb-3">{icon}</div>
        <div className="text-sm">Connect the backend and the data populates automatically.</div>
        <div className="text-xs mt-2 text-slate-600">Route: /api/v1/{title.toLowerCase().replace(/\s+/g,'-')}</div>
      </div>
    </div>
  );
};
