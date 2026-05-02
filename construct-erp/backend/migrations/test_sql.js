const { Pool } = require('pg');

const p = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'construct_erp',
  user: 'postgres',
  password: 'asal@1989'
});

const sql = `
  SELECT p.*,
    pm.name as pm_name, pm.phone as pm_phone,
    se.name as se_name,
    qe.name as qs_name,
    (SELECT COUNT(*) FROM boq_items WHERE project_id = p.id) as boq_count,
    (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE project_id = p.id AND payment_status = 'paid') as amount_collected,
    (SELECT COALESCE(SUM(actual_amount), 0) FROM budget_items WHERE project_id = p.id) as total_spent
  FROM projects p
  LEFT JOIN users pm ON p.project_manager_id = pm.id
  LEFT JOIN users se ON p.site_engineer_id = se.id
  LEFT JOIN users qe ON p.qs_engineer_id = qe.id
  WHERE p.company_id = 'fee65243-22dc-4c89-b249-3045b79b6a54'
`;

p.query(sql)
  .then(r => {
    console.log('Query successful. Rows:', r.rowCount);
    console.log(JSON.stringify(r.rows, null, 2));
  })
  .catch(e => {
    console.log('QUERY ERROR:', e.message);
  })
  .finally(() => p.end());
