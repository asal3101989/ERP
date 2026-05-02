const fs = require('fs');
const path = require('path');
const dir = 'proc/public';

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    let original = content;

    // The breadcrumb separator
    content = content.replace(/<span class="bc-sep">.*?<\/span>/g, '<span class="bc-sep">›</span>');

    // The loader texts
    content = content.replace(/<div class="loader-text">Loading.*?<\/div>/g, '<div class="loader-text">Loading…</div>');
    content = content.replace(/<span class="dash-last-updated" id="dash-last-updated">Loading.*?<\/span>/g, '<span class="dash-last-updated" id="dash-last-updated">Loading…</span>');
    content = content.replace(/Loadingâ ¦/g, 'Loading…');

    if (content !== original) {
        fs.writeFileSync(path.join(dir, f), content, 'utf8');
        console.log('Fixed breadcrumbs and loaders in', f);
    }
});
