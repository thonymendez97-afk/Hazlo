// GET /api/avisos/clave — la clave pública que el teléfono necesita para suscribirse a los avisos.
import { vapid, json } from '../lib/servidor.mjs';

export default async () => {
  try { const { publicKey } = await vapid(); return json({ publicKey }); }
  catch (e) { console.error('clave', e); return json({ error: 'sin-clave' }, 500); }
};

export const config = { path: '/api/avisos/clave' };
