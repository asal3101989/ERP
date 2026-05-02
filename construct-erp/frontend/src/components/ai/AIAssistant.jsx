// src/components/ai/AIAssistant.jsx
// Floating AI chat assistant powered by local Ollama
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, RotateCcw, Copy, Check,
  ChevronDown, Bot, User, Loader2, AlertCircle,
  Minimize2, Maximize2
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const QUICK_PROMPTS = [
  'How do I create an RA Bill?',
  'Explain TDS 194C for contractors',
  'How to add a new vendor?',
  'What is BOQ and how to set it up?',
  'How does GST billing work here?',
  'How to record daily site attendance?',
];

function RobotMark({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 4.5V3.5a1 1 0 1 1 2 0v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 4.5V3.5a1 1 0 1 0-2 0v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="6"
        width="14"
        height="12"
        rx="4"
        fill="currentColor"
        opacity="0.95"
      />
      <circle cx="10" cy="12" r="1.2" fill="#fff" />
      <circle cx="14" cy="12" r="1.2" fill="#fff" />
      <path
        d="M9 15.2c.8.7 1.8 1 3 1s2.2-.3 3-1"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.5 18.5v1M14.5 18.5v1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Simple markdown: bold (**text**), code (`code`), bullet lines
  const renderContent = (text) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Replace **bold**, `code`, and handle bullets
      const parts = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code class="ai-inline-code">$1</code>');

      const isBullet = /^[-•*]\s/.test(line);
      const isNumbered = /^\d+\.\s/.test(line);

      if (isBullet || isNumbered) {
        return (
          <div key={i} className="flex gap-1.5 my-0.5">
            <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }}>
              {isBullet ? '•' : line.match(/^\d+/)?.[0] + '.'}
            </span>
            <span dangerouslySetInnerHTML={{
              __html: line.replace(/^[-•*\d.]+\s/, '')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.+?)`/g, '<code class="ai-inline-code">$1</code>')
            }} />
          </div>
        );
      }

      if (!line.trim()) return <div key={i} className="h-2" />;

      return (
        <div key={i} className={i > 0 ? 'mt-1' : ''}
          dangerouslySetInnerHTML={{ __html: parts }} />
      );
    });
  };

  return (
    <div className={`flex gap-2 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
        isUser
          ? 'text-white'
          : ''
      }`} style={isUser
        ? { background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }
        : { background: 'linear-gradient(135deg, #0891B2, #0D9488)', }
      }>
        {isUser
          ? <User className="w-3 h-3" />
          : <Bot className="w-3 h-3 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] relative ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'text-white rounded-tr-sm'
            : 'rounded-tl-sm'
        }`} style={isUser
          ? { background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }
          : { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }
        }>
          {msg.streaming
            ? <span>{msg.content || 'Thinking'}<span className="inline-block w-1 h-3.5 ml-0.5 rounded-sm animate-pulse" style={{ background: 'var(--primary)', verticalAlign: 'middle' }} /></span>
            : renderContent(msg.content)
          }
        </div>

        {/* Copy button — show on hover for assistant messages */}
        {!isUser && !msg.streaming && msg.content && (
          <button onClick={copy}
            className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
            style={{ color: 'var(--text-dim)', background: 'var(--border)' }}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const { accessToken: token } = useAuthStore();

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError('');
    setStreaming(false);
  };

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || streaming) return;

    setInput('');
    setError('');

    const userMsg = { role: 'user', content };
    const history = [...messages, userMsg];
    const assistantIdx = history.length;
    setMessages([...history, { role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    // Build payload (only role+content for API)
    const payload = history.map(m => ({ role: m.role, content: m.content }));

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: payload }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === 'text') {
            accumulated += parsed.text;
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantIdx] = { role: 'assistant', content: accumulated, streaming: true };
              return updated;
            });
          } else if (parsed.type === 'done') {
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantIdx] = { role: 'assistant', content: accumulated, streaming: false };
              return updated;
            });
          } else if (parsed.type === 'error') {
            throw new Error(parsed.message || 'AI service error');
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Something went wrong. Please try again.');
      // Remove the empty assistant bubble
      setMessages(prev => prev.filter((_, i) => i !== assistantIdx));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, messages, streaming, token]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const panelW = expanded ? 420 : 340;
  const panelH = expanded ? 580 : 460;

  return (
    <>
      {/* Inline styles for markdown code */}
      <style>{`
        .ai-inline-code {
          background: rgba(99,102,241,0.1);
          color: #4F46E5;
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.8em;
          font-family: monospace;
        }
      `}</style>

      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
            color: '#fff',
            boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
          }}
          title="Assistant">
          <RobotMark className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold">Assistant</span>
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: panelW,
            height: panelH,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 48px rgba(15,23,42,0.22)',
            transition: 'width 0.2s, height 0.2s',
          }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white">
              <RobotMark className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white leading-tight">Assistant</div>
              <div className="text-xs text-blue-100 opacity-80">Local AI-powered ERP Assistant</div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clearChat} title="Clear chat"
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setExpanded(v => !v)} title={expanded ? 'Compact' : 'Expand'}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setOpen(false)} title="Close"
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: '#F8FAFC' }}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center pb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)' }}>
                  <RobotMark className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  Hi! I'm Assistant
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Ask me anything about your ERP — BOQ, billing, payroll, HSE, and more.
                </p>
                <div className="grid grid-cols-1 gap-1.5 w-full text-left">
                  {QUICK_PROMPTS.slice(0, 4).map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-2 rounded-lg text-left transition-all hover:border-blue-300"
                      style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick prompts when chat has started */}
          {messages.length > 0 && !streaming && (
            <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto flex-shrink-0"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              {QUICK_PROMPTS.slice(0, 3).map(q => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-all hover:border-blue-300 whitespace-nowrap"
                  style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {q.length > 28 ? `${q.slice(0, 28)}...` : q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2 px-3 py-2.5 flex-shrink-0"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
                placeholder="Ask Assistant..."
              disabled={streaming}
              rows={1}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                maxHeight: 100,
                lineHeight: '1.4',
              }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #1D4ED8, #7C3AED)',
                color: '#fff',
              }}>
              {streaming
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
            </button>
          </div>
        </div>
      )}
    </>
  );
}
