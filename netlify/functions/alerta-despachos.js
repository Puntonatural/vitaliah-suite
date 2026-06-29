const { searchRead } = require('./lib/odoo');
const { sendCard } = require('./lib/gchat');

const WEBHOOK = process.env.GCHAT_LOGISTICA;

exports.handler = async (event) => {
  try {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);

    // Sale orders confirmed but not fully delivered
    const pendientes = await searchRead('sale.order', [
      ['state', '=', 'sale'],
      ['delivery_status', 'in', ['pending', 'partial']]
    ], ['name', 'partner_id', 'date_order', 'amount_total', 'delivery_status', 'team_id'],
    { order: 'date_order asc', limit: 500 });

    let masde5 = 0, masde3 = 0, total = pendientes.length;
    const criticos = [];

    for (const o of pendientes) {
      const fecha = new Date(o.date_order);
      const dias = Math.round((hoy - fecha) / (1000 * 60 * 60 * 24));
      if (dias > 5) {
        masde5++;
        if (criticos.length < 8) {
          criticos.push(`🔴 *${o.name}* — ${o.partner_id[1]} — ${dias}d sin despachar`);
        }
      } else if (dias > 3) {
        masde3++;
      }
    }

    // Group by team
    const porEquipo = {};
    for (const o of pendientes) {
      const team = o.team_id ? o.team_id[1] : 'Sin equipo';
      porEquipo[team] = (porEquipo[team] || 0) + 1;
    }
    const equipoLines = Object.entries(porEquipo)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `• ${t}: ${n}`)
      .join('\n');

    const sections = [
      { type: 'kv', label: 'Pedidos sin despachar', value: `${total} pedidos pendientes`, icon: 'BUS' },
      { type: 'kv', label: 'Más de 5 días (crítico)', value: `${masde5} pedidos`, icon: 'TICKET' },
      { type: 'kv', label: 'Entre 3-5 días (alerta)', value: `${masde3} pedidos`, icon: 'CLOCK' },
      { type: 'divider' },
    ];

    if (equipoLines) {
      sections.push({ type: 'text', content: '*Por equipo de ventas:*\n' + equipoLines });
    }

    if (criticos.length > 0) {
      sections.push({ type: 'divider' });
      sections.push({ type: 'text', content: '*Pedidos críticos (>5 días):*\n' + criticos.join('\n') });
      if (masde5 > 8) sections.push({ type: 'text', content: `... y ${masde5 - 8} más` });
    } else {
      sections.push({ type: 'text', content: '✅ No hay pedidos con más de 5 días sin despachar.' });
    }

    sections.push({ type: 'button', label: '🚚 Abrir Dashboard Despachos', url: 'https://despachos.vitaliah.co/' });

    const hoyFmt = hoy.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    await sendCard(WEBHOOK, '🚚 Reporte de Despachos', hoyFmt, sections);

    return { statusCode: 200, body: JSON.stringify({ ok: true, total, masde5, masde3 }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.config = { schedule: "@daily" };
