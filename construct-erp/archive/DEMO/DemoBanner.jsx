// src/components/layout/DemoBanner.jsx
import React, { useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { isDemoMode } = useAuthStore();

  if (!isDemoMode || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
      <span className="text-amber-300 flex-1">
        <span className="font-bold text-amber-400">Demo Mode — Offline</span>
        {' '}• All data is local mock data. Start the backend server to use live data.
        {' '}<span className="text-amber-500">npm run dev</span> in the backend folder.
      </span>
      <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-400 ml-2">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
