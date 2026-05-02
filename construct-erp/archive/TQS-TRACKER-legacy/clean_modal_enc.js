const fs = require('fs');
const path = require('path');
const dir = 'proc/public';

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    
    // Structural replacements for the modal
    content = content.replace(/<button class="modal-close".*?<\/button>/g, '<button class="modal-close" onclick="closeModal()">✕</button>');
    
    content = content.replace(/<label for="pri-high" class="pri-label high">.*?High<\/label>/g, '<label for="pri-high" class="pri-label high">🔴 High</label>');
    content = content.replace(/<label for="pri-med" class="pri-label medium">.*?Medium<\/label>/g, '<label for="pri-med" class="pri-label medium">🟡 Medium</label>');
    content = content.replace(/<label for="pri-low" class="pri-label low">.*?Low<\/label>/g, '<label for="pri-low" class="pri-label low">⚪ Low</label>');
    
    content = content.replace(/Gate 2.*?<\/textarea>/g, 'Gate 2…</textarea>');
    content = content.replace(/Submit indent.*?<\/button>/g, 'Submit indent →</button>');
    
    // The specific modal title logic
    content = content.replace(/<span id="modal-project-label">Select project<\/span>.*?IND/g, '<span id="modal-project-label">Select project</span> · IND');

    // General bad encoding blanket fix across all html
    content = content.replace(/â‹…/g, '·');
    content = content.replace(/â ¦/g, '…');
    content = content.replace(/âšª/g, '⚪');
    content = content.replace(/ðŸ”´/g, '🔴');
    content = content.replace(/ðŸŸ¡/g, '🟡');
    content = content.replace(/â¨¯/g, '✕');
    content = content.replace(/ðŸŸ¢/g, '🟢');

    fs.writeFileSync(path.join(dir, f), content, 'utf8');
});
console.log('Fixed modal typography encodings');
