import React, { useRef, useState } from 'react';
import { Paperclip, Upload, X, FileText, Image, File, Download, Eye } from 'lucide-react';
import { uploadAPI } from '../../api/client';
import toast from 'react-hot-toast';

const EXT_ICON = {
  jpg: Image, jpeg: Image, png: Image,
  pdf: FileText,
};

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  return EXT_ICON[ext] || File;
}

function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPanel({ attachments = [], onUpdate, disabled = false, label = 'Attachments' }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('files', f));
      const res = await uploadAPI.upload(fd);
      const urls = res.data?.urls || [];
      const newItems = Array.from(files).map((f, i) => ({
        url: urls[i],
        name: f.name,
        size: f.size,
        type: f.type,
        uploaded_at: new Date().toISOString(),
      }));
      const updated = [...attachments, ...newItems];
      onUpdate(updated);
      toast.success(`${newItems.length} file(s) attached`);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const remove = (idx) => {
    const updated = attachments.filter((_, i) => i !== idx);
    onUpdate(updated);
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Paperclip size={14} color="#6366f1" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>({attachments.length} file{attachments.length !== 1 ? 's' : ''})</span>
      </div>

      {/* Drop zone */}
      {!disabled && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed #c7d2fe',
            borderRadius: 10,
            padding: '14px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: uploading ? '#f5f3ff' : '#fafafa',
            transition: 'all 0.15s',
            marginBottom: 10,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#6366f1'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf,.xlsx,.docx,.dwg,.dxf"
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, border: '2px solid #c7d2fe', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Uploading...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Upload size={14} color="#6366f1" />
              <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Click or drag files here</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>· PDF, Images, Excel, Word (max 10MB)</span>
            </div>
          )}
        </div>
      )}

      {/* File list */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map((att, i) => {
            const Icon = fileIcon(att.name);
            const isImage = /\.(jpg|jpeg|png)$/i.test(att.name);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: '#f8fafc', border: '1px solid #e2e8f0',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color="#6366f1" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</p>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>{fileSize(att.size)}</p>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {isImage && att.url && (
                    <a href={att.url} target="_blank" rel="noreferrer"
                      style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                      <Eye size={13} color="#3b82f6" />
                    </a>
                  )}
                  {att.url && (
                    <a href={att.url} download={att.name}
                      style={{ width: 28, height: 28, borderRadius: 6, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                      <Download size={13} color="#10b981" />
                    </a>
                  )}
                  {!disabled && (
                    <button onClick={() => remove(i)}
                      style={{ width: 28, height: 28, borderRadius: 6, background: '#fef2f2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <X size={13} color="#ef4444" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {attachments.length === 0 && disabled && (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>No attachments</p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
