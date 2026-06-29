const ODOO_URL = process.env.ODOO_URL || 'https://puntonatural.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'puntonatural-main-6184743';
const ODOO_USER = process.env.ODOO_USER || 'julian.zamora@gmail.com';
const ODOO_API_KEY = process.env.ODOO_API_KEY;

let _uid = null;

async function jsonRpc(service, method, args) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.data?.message || json.error.message || 'Odoo error');
  return json.result;
}

async function getUid() {
  if (_uid) return _uid;
  _uid = await jsonRpc('common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}]);
  if (!_uid) throw new Error('Odoo authentication failed');
  return _uid;
}

async function searchRead(model, domain, fields, opts = {}) {
  const uid = await getUid();
  return jsonRpc('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY, model, 'search_read', [domain],
    { fields, limit: opts.limit || 5000, order: opts.order || '', ...(opts.context ? { context: opts.context } : {}) }
  ]);
}

async function searchCount(model, domain) {
  const uid = await getUid();
  return jsonRpc('object', 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, 'search_count', [domain], {}]);
}

module.exports = { searchRead, searchCount, getUid };
