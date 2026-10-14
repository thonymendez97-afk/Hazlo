// POST /api/avisos — el teléfono manda sus tareas con hora para que el servidor le avise.
// DELETE /api/avisos — el teléfono deja de recibir avisos.
import { store, json } from '../lib/servidor.mjs';
import { cleanSync, deviceId, pruneSent } from '../lib/avisos.mjs';

export default async req => {
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'json' }, 400); }
  const s = store();

  if (req.method === 'DELETE') {
    if (!body || typeof body.endpoint !== 'string') return json({ error: 'endpoint' }, 400);
    const id = await deviceId(body.endpoint);
    await Promise.all([s.delete('disp/' + id), s.delete('env/' + id)]);
    return json({ ok: true });
  }
  if (req.method !== 'POST') return json({ error: 'metodo' }, 405);

  const data = cleanSync(body);
  if (!data) return json({ error: 'datos' }, 400);
  const id = await deviceId(data.sub.endpoint);
  const { avisados, ...dev } = data;
  dev.updatedAt = Date.now();
  await s.setJSON('disp/' + id, dev);

  // Lo que la app ya avisó estando abierta no se vuelve a mandar.
  if (avisados.length) {
    const sent = (await s.get('env/' + id, { type: 'json' })) || {};
    let changed = false;
    for (const k of avisados) if (!sent[k]) { sent[k] = Date.now(); changed = true; }
    if (changed) await s.setJSON('env/' + id, pruneSent(sent));
  }
  return json({ ok: true, tareas: dev.tasks.length });
};

export const config = { path: '/api/avisos', method: ['POST', 'DELETE'] };
