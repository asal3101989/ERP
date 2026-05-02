const fs = require('fs');
const path = require('path');
const dir = 'proc/public';

const rootBlock = `  :root {
    --bg: #f0f2f5;
    --surface: #ffffff;
    --surface2: #f5f7fa;
    --border: #dde1e9;
    --border-strong: #c8cdd9;
    --text: #1a1f36;
    --text-2: #6b7592;
    --text-3: #9ba5c0;
    --accent: #2563eb;
    --accent-bg: #eff6ff;
    --accent-border: #bfdbfe;
    --blue: #2563eb;
    --blue-bg: #eff6ff;
    --blue-border: #bfdbfe;
    --green: #059669;
    --green-bg: #ecfdf5;
    --green-border: #a7f3d0;
    --red: #dc2626;
    --red-bg: #fef2f2;
    --red-border: #fecaca;
    --warning: #d97706;
    --warning-bg: #fffbeb;
    --warning-border: #fde68a;
    --radius: 8px;
    --radius-sm: 6px;
    --shadow: 0 1px 4px rgba(0,0,0,0.08);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.06);
  }`;

fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'login.html').forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    
    // Replace exact root block logic
    content = content.replace(/:root\s*\{[\s\S]*?--shadow-md.*?\}/, rootBlock);
    
    // Convert old hardcoded beige logic in CSS to match our new layout
    if (f === 'index.html') {
        // Change sidebar from white/border to dark blue
        content = content.replace(/\.sidebar\s*\{[\s\S]*?\}/, `.sidebar {
    width: 240px; min-width: 240px;
    background: #0b1f4e;
    color: #ffffff;
    display: flex; flex-direction: column;
    height: 100vh; position: relative; z-index: 10;
  }`);
        content = content.replace(/\.sidebar-logo\s*\{/, '.sidebar-logo { border-bottom: 1px solid rgba(255,255,255,0.1);');
        content = content.replace(/\.logo-name\s*\{[\s\S]*?\}/, '.logo-name { font-size: 17px; font-weight: 600; color: #ffffff; margin-top: 2px; }');
        content = content.replace(/\.nav-group-label\s*\{[\s\S]*?\}/, '.nav-group-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9ba5c0; padding: 10px 10px 4px; }');
        content = content.replace(/\.nav-item\s*\{[\s\S]*?\}/, `.nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 10px; border-radius: var(--radius-sm);
    font-size: 12.5px; font-weight: 400; color: #a9b5d3;
    cursor: pointer; transition: all 0.13s; margin-bottom: 1px;
    user-select: none;
  }`);
        content = content.replace(/\.nav-item:hover\s*\{[\s\S]*?\}/, '.nav-item:hover { background: rgba(255,255,255,0.06); color: #ffffff; }');
        content = content.replace(/\.nav-item\.active\s*\{[\s\S]*?\}/, `.nav-item.active {
    background: rgba(37,99,235,0.15); color: #bfdbfe;
    font-weight: 500;
  }`);
        content = content.replace(/\.sidebar-footer\s*\{/, '.sidebar-footer { border-top: 1px solid rgba(255,255,255,0.1);');
        content = content.replace(/\.user-name\s*\{[\s\S]*?\}/, '.user-name  { font-size: 12.5px; font-weight: 500; color: #ffffff; }');
        content = content.replace(/\.project-pill\s*\{[\s\S]*?\}/, `.project-pill {
    display: flex; align-items: center; gap: 6px;
    background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px; padding: 4px 10px 4px 8px;
    font-size: 10.5px; color: #9ba5c0; margin-top: 8px; cursor: pointer;
  }`);
    }

    fs.writeFileSync(path.join(dir, f), content, 'utf8');
});
console.log('Successfully applied TQS theme');
