const fs = require('fs');
const path = require('path');

/**
 * Extracts Measurement Book items from a CSV document
 * @param {string} filePath - Path to the uploaded file
 */
async function extractMBItems(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const items = [];

  if (lines.length < 2) return items;

  // Basic CSV line parser (handles quotes)
  const parseLine = (line) => {
    const result = [];
    let currentVal = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && inQuotes && line[i + 1] === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    result.push(currentVal.trim());
    return result;
  };

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = parseLine(lines[i]);
    
    // Structure: BOQ_Sr_No, Analytical_Description, Location, Execution_Date, Nos, Len, Br, Ht, Ded
    if (cols.length >= 4) {
      items.push({
        sr_no: cols[0],
        description: cols[1],
        location: cols[2],
        entry_date: cols[3],
        nos: parseFloat(cols[4] || 1) || 1,
        length: parseFloat(cols[5] || 0) || 0,
        breadth: parseFloat(cols[6] || 0) || 0,
        height: parseFloat(cols[7] || 0) || 0,
        deduction: parseFloat(cols[8] || 0) || 0
      });
    }
  }
  return items;
}

module.exports = { extractMBItems };
