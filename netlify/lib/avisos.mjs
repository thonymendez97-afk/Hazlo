// ¡Hazlo! — lógica de los avisos push, compartida por las funciones del servidor.
// Todo lo que decide "a quién avisar y cuándo" vive aquí, sin depender de Netlify, para poder probarlo.

export const STORE = 'hazlo-avisos';
export const VENTANA_MIN = 10;          // si el servidor se atrasa, aún avisa hasta 10 minutos después
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad = n => String(n).padStart(2, '0');
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export function fmtTime(t) {
  let [h, m] = t.split(':').map(Number);
  const pm = h >= 12; h = h % 12 || 12;
  return h + ':' + pad(m) + (pm ? ' p. m.' : ' a. m.');
}

// Clave corta y estable para cada teléfono, a partir de su dirección de notificaciones.
export async function deviceId(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(buf).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

export function validTz(tz) {
  if (typeof tz !== 'string' || tz.length > 64) return 'America/Lima';
  try { new Intl.DateTimeFormat('es', { timeZone: tz }); return tz; } catch (e) { return 'America/Lima'; }
}

// Fecha y minuto del día en la zona horaria del teléfono.
export function localNow(tz, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return {
    today: parts.year + '-' + parts.month + '-' + parts.day,
    min: Number(parts.hour) * 60 + Number(parts.minute),
    sec: Number(parts.second),
    ts: date.getTime(),
  };
}

// Limpia lo que manda el teléfono: solo lo necesario para avisar.
export function cleanSync(body) {
  if (!body || typeof body !== 'object') return null;
  const sub = body.sub;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000) return null;
  if (!sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') return null;
  const str = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);
  const tasks = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, 500)
    .filter(t => t && typeof t.id === 'string' && TIME_RE.test(t.time))
    .map(t => ({
      id: str(t.id, 80),
      title: str(t.title, 120) || 'Tarea',
      emoji: str(t.emoji, 16),
      time: t.time,
      date: DATE_RE.test(t.date) ? t.date : '',
      repeat: t.repeat === 'diaria' ? 'diaria' : '',
      done: t.done === true,
      doneOn: DATE_RE.test(t.doneOn) ? t.doneOn : '',
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt : 0,
    }));
  const snoozes = {};
  if (body.snoozes && typeof body.snoozes === 'object') {
    for (const [id, ts] of Object.entries(body.snoozes).slice(0, 50)) if (Number.isFinite(ts)) snoozes[str(id, 80)] = ts;
  }
  const avisados = (Array.isArray(body.avisados) ? body.avisados : []).filter(k => typeof k === 'string' && k.length < 200).slice(0, 500);
  return {
    sub: { endpoint: sub.endpoint, keys: { p256dh: str(sub.keys.p256dh, 200), auth: str(sub.keys.auth, 100) } },
    tz: validTz(body.tz),
    tasks, snoozes, avisados,
  };
}

const isDone = (t, today) => (t.repeat === 'diaria' ? (t.done && t.doneOn === today) : t.done);
// Mismas reglas que la app: diarias, las de hoy y las que no tienen fecha.
function alertMinute(t, today) {
  if (!t.time || isDone(t, today)) return null;
  if (t.repeat === 'diaria' || t.date === today || !t.date) return toMin(t.time);
  return null;
}
export const alertKey = (t, today) => t.id + '|' + (t.repeat === 'diaria' || t.date ? today : 'sin-fecha') + '|' + t.time;

// Qué avisos le tocan a un teléfono ahora. `sent` son los avisos ya dados (clave -> cuándo).
export function dueAlerts(dev, sent, date = new Date()) {
  const now = localNow(dev.tz, date);
  const out = [];
  const byId = new Map(dev.tasks.map(t => [t.id, t]));
  for (const t of dev.tasks) {
    const m = alertMinute(t, now.today);
    if (m === null || now.min < m || now.min - m > VENTANA_MIN) continue;
    const key = alertKey(t, now.today);
    if (sent[key]) continue;
    const at = now.ts - ((now.min - m) * 60 + now.sec) * 1000;   // momento exacto de la hora de la tarea
    if (t.createdAt > at + 59e3) continue;                       // se creó después de su hora
    out.push({ key, task: t, body: 'Es hora · ' + fmtTime(t.time) });
  }
  for (const [id, ts] of Object.entries(dev.snoozes || {})) {
    const t = byId.get(id);
    if (!t || isDone(t, now.today) || ts > now.ts || now.ts - ts > VENTANA_MIN * 60e3) continue;
    const key = 'pospuesta|' + id + '|' + ts;
    if (sent[key]) continue;
    out.push({ key, task: t, body: 'Te lo recuerdo otra vez' });
  }
  return out;
}

export function payloadFor(a) {
  const t = a.task;
  return JSON.stringify({
    title: '⏰ ' + (t.emoji ? t.emoji + ' ' : '') + t.title,
    body: a.body,
    tag: 'hazlo-' + t.id,
    id: t.id,
    key: a.key,
  });
}

// Olvida avisos de hace más de 3 días (los de tareas sin fecha se guardan siempre).
export function pruneSent(sent, ts = Date.now()) {
  const limit = ts - 3 * 864e5, out = {};
  for (const [k, v] of Object.entries(sent || {})) if (v >= limit || k.includes('|sin-fecha|')) out[k] = v;
  return out;
}
