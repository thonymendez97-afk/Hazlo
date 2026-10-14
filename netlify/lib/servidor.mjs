// ¡Hazlo! — piezas del servidor que sí dependen de Netlify: almacenamiento y claves de notificación.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { STORE } from './avisos.mjs';

export const store = () => getStore({ name: STORE, consistency: 'strong' });

// Las claves de notificación (VAPID) se crean solas la primera vez y quedan guardadas.
// Así no hay que configurar nada a mano en Netlify.
let cached = null;
export async function vapid(s = store()) {
  if (cached) return cached;
  let keys = await s.get('config/vapid', { type: 'json' });
  if (!keys) {
    const fresh = webpush.generateVAPIDKeys();
    const res = await s.setJSON('config/vapid', fresh, { onlyIfNew: true });
    keys = res.modified ? fresh : await s.get('config/vapid', { type: 'json' });
  }
  cached = keys;
  return keys;
}

export async function sender(s = store()) {
  const keys = await vapid(s);
  const subject = process.env.URL && /^https:\/\//.test(process.env.URL) ? process.env.URL : 'https://hazlo.netlify.app';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 600, urgency: 'high' });
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
