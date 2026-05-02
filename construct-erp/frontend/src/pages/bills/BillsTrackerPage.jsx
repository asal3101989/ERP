// src/pages/bills/BillsTrackerPage.jsx
// Embeds the TQS Bill Tracker (running on port 3001) inside ConstructERP
import React, { useState, useRef } from 'react';
import { ExternalLink, RefreshCw, Maximize2, Minimize2, AlertCircle } from 'lucide-react';

const TQS_URL = 'http://localhost:3001';

export default function BillsTrackerPage() {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef(null);

  const handleLoad = () => { setLoading(false); setError(false); };
  const handleError = () => { setLoading(false); setError(true); };

  const reload = () => {
    setLoading(true);
    setError(false);
    if (iframeRef.current) iframeRef.current.src = TQS_URL;
  };

  return (
    <div className={fullscreen
      ? 'fixed inset-0 z-50 flex flex-col'
      : 'flex flex-col'
    } style={{ height: fullscreen ? '100vh' : 'calc(100vh - 52px - 40px)', minHeight: 500 }}>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 rounded-t-xl"
        style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderBottom: 'none' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            TQS Bill Tracker
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
            Integrated
          </span>
        </div>

        <div className="flex-1" />

        <a href={TQS_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <ExternalLink className="w-3.5 h-3.5" />
          Open in tab
        </a>

        <button onClick={reload}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          title="Reload">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button onClick={() => setFullscreen(v => !v)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* iframe */}
      <div className="flex-1 relative rounded-b-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', borderTop: 'none' }}>

        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
            style={{ background: '#F8FAFC' }}>
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading TQS Bill Tracker…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10"
            style={{ background: '#F8FAFC' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ background: '#FEF2F2' }}>
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>
              TQS Bill Tracker offline
            </p>
            <p className="text-sm mb-5 text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
              The TQS server is not running on port 3001. Start it with{' '}
              <code className="px-1 py-0.5 rounded text-xs" style={{ background: '#F1F5F9', color: '#1D4ED8' }}>
                node server.js
              </code>{' '}
              in the TQS folder.
            </p>
            <div className="flex gap-2">
              <button onClick={reload}
                className="btn-primary px-4 py-2 text-sm">
                Retry
              </button>
              <a href={TQS_URL} target="_blank" rel="noopener noreferrer"
                className="btn-secondary px-4 py-2 text-sm">
                Open directly
              </a>
            </div>
            <div className="mt-6 px-4 py-3 rounded-lg text-xs text-left"
              style={{ background: '#F8FAFC', border: '1px solid var(--border)', maxWidth: 360 }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Start TQS server:</p>
              <code className="block" style={{ color: '#1D4ED8' }}>
                cd "E:\projects\constructio -ERP\construct-erp\app$\final01042026"<br />
                node server.js
              </code>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={TQS_URL}
          onLoad={handleLoad}
          onError={handleError}
          title="TQS Bill Tracker"
          className="w-full h-full"
          style={{ border: 'none', display: error ? 'none' : 'block' }}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
