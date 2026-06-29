const { searchRead } = require('./lib/odoo');
const { sendCard } = require('./lib/gchat');

const WEBHOOK = process.env.GCHAT_INVENTARIO;
const PREFIJOS_COMPRA = ['MAP', 'ENV', 'ETI', 'CAJ', 'CUP', 'BOL', 'LAM', 'LIN', 'TER'];

exports.handler = async (event) => {
  try {
    const records = await searchRead('stock.warehouse.orderpoint', [], [
      'product_id', 'product_min_qty', 'product_max_qty',
      'qty_to_order', 'qty_on_hand', 'qty_forecast',
      'location_id', 'route_id'
    ]);

    let negativos = 0, pronNeg = 0, bajoMin = 0, sinRuta = 0, total = records.length;
    const urgentes = [];

    for (const r of records) {
      const nombre = r.product_id ? r.product_id[1] : '';
      const aMano = r.qty_on_hand || 0;
      const pronostico = r.qty_forecast || 0;
      const min = r.product_min_qty || 0;
      const ruta = r.route_id ? r.route_id[1] : '';

      if (aMano < 0) {
        negativos++;
        urgentes.push(`🔴 *${nombre}*: stock ${Math.round(aMano)}`);
      } else if (pronostico < 0) {
        pronNeg++;
        if (urgentes.length < 15) urgentes.push(`🟠 *${nombre}*: pronóstico ${Math.round(pronostico)}`);
      } else if (min > 0 && aMano < min) {
        bajoMin++;
      }
      if (!ruta) sinRuta++;
    }

    const sections = [
      { type: 'kv', label: 'Catálogo total', value: `${total} productos con regla de reposición`, icon: 'BOOKMARK' },
      { type: 'kv', label: 'Stock negativo', value: `${negativos} productos`, icon: 'TICKET' },
      { type: 'kv', label: 'Pronóstico negativo', value: `${pronNeg} productos`, icon: 'DESCRIPTION' },
      { type: 'kv', label: 'Bajo mínimo', value: `${bajoMin} productos`, icon: 'INVITE' },
      { type: 'kv', label: 'Sin ruta asignada', value: `${sinRuta} productos`, icon: 'BUS' },
      { type: 'divider' },
    ];

    if (urgentes.length > 0) {
      sections.push({ type: 'text', content: '*Productos críticos:*\n' + urgentes.slice(0, 10).join('\n') });
      if (urgentes.length > 10) sections.push({ type: 'text', content: `... y ${urgentes.length - 10} más` });
    } else {
      sections.push({ type: 'text', content: '✅ No hay productos en estado crítico hoy.' });
    }

    sections.push({ type: 'button', label: '📦 Abrir Dashboard Inventario', url: 'https://repo.inventario.vitaliah.co/' });

    const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    await sendCard(WEBHOOK, '📦 Reporte de Inventario', hoy, sections);

    return { statusCode: 200, body: JSON.stringify({ ok: true, negativos, pronNeg, bajoMin }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.config = { schedule: "@daily" };
