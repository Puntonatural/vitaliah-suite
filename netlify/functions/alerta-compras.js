const { searchRead, searchCount } = require('./lib/odoo');
const { sendCard } = require('./lib/gchat');

const WEBHOOK = process.env.GCHAT_COMPRAS;

function fmtCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

exports.handler = async (event) => {
  try {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    const since = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const sinceStr = since.toISOString().slice(0, 10);

    const atrasadas = await searchRead('purchase.order', [
      ['state', 'in', ['purchase', 'done']],
      ['receipt_status', '=', 'pending'],
      ['date_planned', '<', hoyStr],
      ['date_approve', '>=', sinceStr]
    ], ['name', 'partner_id', 'amount_total', 'date_planned'], { order: 'date_planned asc', limit: 500 });

    const sinFacturar = await searchCount('purchase.order', [
      ['state', 'in', ['purchase', 'done']],
      ['receipt_status', '=', 'full'],
      ['invoice_status', '=', 'to invoice'],
      ['date_approve', '>=', sinceStr]
    ]);

    const pendientes = await searchCount('purchase.order', [
      ['state', 'in', ['purchase', 'done']],
      ['receipt_status', '=', 'pending'],
      ['date_approve', '>=', sinceStr]
    ]);

    let valorAtrasadas = 0;
    const topAtrasadas = [];
    for (const o of atrasadas) {
      valorAtrasadas += o.amount_total || 0;
      const dias = Math.round((new Date() - new Date(o.date_planned)) / (1000 * 60 * 60 * 24));
      if (topAtrasadas.length < 8) {
        topAtrasadas.push(`🔴 *${o.name}* — ${o.partner_id[1]} — ${fmtCOP(o.amount_total)} (${dias}d atraso)`);
      }
    }

    const sections = [
      { type: 'kv', label: 'Órdenes atrasadas', value: `${atrasadas.length} — ${fmtCOP(valorAtrasadas)} en riesgo`, icon: 'TICKET' },
      { type: 'kv', label: 'Recepciones pendientes', value: `${pendientes} órdenes`, icon: 'BUS' },
      { type: 'kv', label: 'Recibidas sin facturar', value: `${sinFacturar} órdenes`, icon: 'DOLLAR' },
      { type: 'divider' },
    ];

    if (topAtrasadas.length > 0) {
      sections.push({ type: 'text', content: '*Top atrasadas:*\n' + topAtrasadas.join('\n') });
      if (atrasadas.length > 8) sections.push({ type: 'text', content: `... y ${atrasadas.length - 8} más` });
    } else {
      sections.push({ type: 'text', content: '✅ No hay órdenes atrasadas hoy.' });
    }

    sections.push({ type: 'button', label: '🛒 Abrir Dashboard Compras', url: 'https://compras.vitaliah.co/apps/supply-chain/' });

    const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    await sendCard(WEBHOOK, '🛒 Reporte de Compras', hoy, sections);

    return { statusCode: 200, body: JSON.stringify({ ok: true, atrasadas: atrasadas.length, sinFacturar, pendientes }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.config = { schedule: "@daily" };
