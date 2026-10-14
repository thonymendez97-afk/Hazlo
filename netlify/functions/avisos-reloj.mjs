// Cada minuto: revisa las tareas de cada teléfono y manda los avisos que tocan.
import { store, sender } from '../lib/servidor.mjs';
import { dueAlerts, payloadFor, pruneSent } from '../lib/avisos.mjs';

const OLVIDAR = 60 * 864e5;   // teléfonos que no abren la app en 60 días se dejan de revisar

export async function tick(s, send, date = new Date()) {
  const { blobs } = await s.list({ prefix: 'disp/' });
  let enviados = 0, borrados = 0;
  const queue = blobs.map(b => b.key);
  async function work() {
    for (let key = queue.shift(); key; key = queue.shift()) {
      const id = key.slice(5);
      try {
        const dev = await s.get(key, { type: 'json' });
        if (!dev) continue;
        if (date.getTime() - (dev.updatedAt || 0) > OLVIDAR) { await Promise.all([s.delete(key), s.delete('env/' + id)]); borrados++; continue; }
        const sent = (await s.get('env/' + id, { type: 'json' })) || {};
        const due = dueAlerts(dev, sent, date);
        if (!due.length) continue;
        let gone = false;
        for (const a of due) {
          try { await send(dev.sub, payloadFor(a)); enviados++; }
          catch (e) {
            if (e && (e.statusCode === 404 || e.statusCode === 410)) { gone = true; break; }
            console.error('aviso', id, e && e.statusCode, e && e.body);
          }
          sent[a.key] = date.getTime();   // aunque falle, no se reintenta en bucle
        }
        if (gone) { await Promise.all([s.delete(key), s.delete('env/' + id)]); borrados++; }
        else await s.setJSON('env/' + id, pruneSent(sent, date.getTime()));
      } catch (e) { console.error('telefono', id, e); }
    }
  }
  await Promise.all(Array.from({ length: 8 }, work));
  return { telefonos: blobs.length, enviados, borrados };
}

export default async () => {
  const s = store();
  const r = await tick(s, await sender(s));
  if (r.enviados || r.borrados) console.log('avisos', r);
};

export const config = { schedule: '* * * * *' };
