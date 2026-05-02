const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function check() {
  const SQL = await initSqlJs();
  const dbData = fs.readFileSync(path.join(__dirname, 'tqs_erp.db'));
  const db = new SQL.Database(dbData);
  
  const items = db.exec('SELECT * FROM stock_items WHERE item_code="Portland Cement"');
  console.log("Stock Items:");
  if (items.length) {
    console.table(items[0].values);
  } else {
    console.log("Not found.");
  }

  const ledger = db.exec('SELECT * FROM stock_ledger WHERE item_code="Portland Cement"');
  console.log("\nStock Ledger:");
  if (ledger.length) {
    console.table(ledger[0].values);
  } else {
    console.log("Not found.");
  }
}
check();
