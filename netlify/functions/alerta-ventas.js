const { searchRead } = require('./lib/odoo');
const { sendCard } = require('./lib/gchat');

const WEBHOOK = process.env.GCHAT_COMERCIAL;

const CUOTAS = {
  'ADDY MARYORI MEJIA GALLO': 1000000,
  'ADRIANA MARIA ZULETA POLANCO': 37000000,
  'BRAYAN DAVID MARTINEZ PALACIOS': 500000,
  'CLAUDIA CECILIA HOLGUIN RUIZ': 87000000,
  'GINNA PAOLA CASTILLO OROPEZA': 18000000,
  'MARY YOLI RONCANCIO GALINDO': 67000000,
  'SULMA YULIER MUÑOZ MUÑOZ': 150000000,
};

function fmtCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

exports.handler = async (event) => {
  try {
    const now = new Date();
    const sinceStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const orders = await searchRead('sale.order', [
      ['state', '=', 'sale'],
      ['date_order', '>=', sinceStr],
      ['x_studio_vendedor_interno', '!=', false],
      ['x_studio_vendedor_interno', 'not in', [1, 6, 71]]
    ], ['x_studio_vendedor_interno', 'amount_total', 'invoice_status']);

    const vendedores = {};
    for (const o of orders) {
      const nombre = o.x_studio_vendedor_interno ? o.x_studio_vendedor_interno[1] : 'Sin asignar';
      if (!vendedores[nombre]) vendedores[nombre] = { total: 0, facturado: 0, ordenes: 0 };
      vendedores[nombre].ordenes++;
      vendedores[nombre].total += o.amount_total || 0;
      if (o.invoice_status === 'invoiced') vendedores[nombre].facturado += o.amount_total || 0;
    }

    let totalVentas = 0, totalCuota = 0;
    const lines = [];
    const sorted = Object.keys(vendedores).sort((a, b) => vendedores[b].total - vendedores[a].total);

    for (const v of sorted) {
      const d = vendedores[v];
      const cuota = CUOTAS[v] || 0;
      totalVentas += d.total;
      totalCuota += cuota;
      const pct = cuota > 0 ? Math.round((d.total / cuota) * 100) : 0;
      const emoji = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : cuota > 0 ? '🔴' : '⚪';
      const pctStr = cuota > 0 ? ` (${pct}%)` : '';
      lines.push(`${emoji} *${v}*: ${fmtCOP(d.total)}${pctStr} — ${d.ordenes} órdenes`);
    }

    const pctTotal = totalCuota > 0 ? Math.round((totalVentas / totalCuota) * 100) : 0;
    const diasMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const diaActual = now.getDate();

    const sections = [
      { type: 'kv', label: 'Total ventas del mes', value: fmtCOP(totalVentas), icon: 'DOLLAR' },
      { type: 'kv', label: 'Cuota equipo', value: `${fmtCOP(totalCuota)} — ${pctTotal}% cumplimiento`, icon: 'TICKET' },
      { type: 'kv', label: 'Avance del mes', value: `Día ${diaActual} de ${diasMes}`, icon: 'CLOCK' },
      { type: 'divider' },
      { type: 'text', content: '*Vendedores:*\n' + lines.join('\n') },
      { type: 'button', label: '📊 Abrir Dashboard Cuotas', url: 'https://cuotas.vitaliah.co/' }
    ];

    const hoy = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    await sendCard(WEBHOOK, '📊 Reporte de Ventas', hoy, sections);

    return { statusCode: 200, body: JSON.stringify({ ok: true, totalVentas, pctTotal }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.config = { schedule: "@daily" };
