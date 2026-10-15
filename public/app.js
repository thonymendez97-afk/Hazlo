/* ¡Hazlo! — lógica de la app */
(() => {
  'use strict';
  document.documentElement.lang = 'es';
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- Datos fijos ---------- */
  const COLORS = ['naranja', 'verde', 'azul', 'lila', 'amarillo'];
  const COLOR_NAMES = { naranja: 'Naranja', verde: 'Verde', azul: 'Azul', lila: 'Lila', amarillo: 'Amarillo' };
  const PRIOS = [['', 'Ninguna'], ['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']];
  const PRIO_KEYS = ['alta', 'media', 'baja'];
  const PRIO_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const EMOJIS = ['🛒', '📚', '🏋️', '🐱', '🐾', '🌱', '💸', '📞', '🧹', '🍳', '💼', '📝', '💻', '🧺', '🚗', '🩺', '🎂', '✈️', '☕', '🎯'];
  const KEYWORDS = [
    ['🛒', /\b(compra|comprar|supermercado|viveres|mercado|bodega|tienda)/],
    ['📚', /\b(estudi|examen|curso|clase|practica|leer|libro|lectura|exposicion|universidad|tarea de)/],
    ['🏋️', /\b(gimnasio|gym|entrena|cardio|correr|ejercicio|pesas)/],
    ['🐱', /\b(gata|gato|gatita|michi)/],
    ['🐾', /\b(perr|mascota|veterinari|pasear al)/],
    ['🌱', /\b(regar|planta|jardin)/],
    ['💸', /\b(pagar|pago|recibo|luz\b|agua\b|internet|alquiler|banco|transferi|yape|plin)/],
    ['📞', /\b(llamar|llamada|telefono|whatsapp)/],
    ['🧹', /\b(limpiar|limpieza|ordenar|barrer|trapear|basura)/],
    ['🍳', /\b(cocinar|comida|almuerzo|cena\b|desayuno|receta)/],
    ['💼', /\b(trabajo|reunion|turno|oficina|cliente|informe)/],
    ['📝', /\b(escribir|apuntes|notas|redactar|correo|email)/],
    ['💻', /\b(computadora|laptop|codigo|programar|pagina web|app\b)/],
    ['🧺', /\b(lavar|ropa\b|lavanderia|planchar)/],
    ['🚗', /\b(carro|auto\b|gasolina|taller|mecanico|manejar)/],
    ['🩺', /\b(medico|doctor|cita\b|dentista|farmacia|vacuna)/],
    ['🎂', /\b(cumple|fiesta|regalo|aniversario)/],
    ['✈️', /\b(viaje|vuelo|maleta|pasaje|aeropuerto)/],
    ['☕', /\b(cafe\b)/],
  ];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
  const LS_TASKS = 'hazlo.tareas.v1';
  const LS_FILTER = 'hazlo.filtro';
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^\d{2}:\d{2}$/;
  const RING_C = 131.95;

  /* ---------- Estado ---------- */
  const S = {
    mode: 'loading',          // 'loading' | 'db' | 'local'
    db: null,
    canWrite: true,
    server: new Map(),        // lo último que confirmó la base de datos
    pending: new Map(),       // cambios locales aún sin confirmar (id -> tarea | null)
    filter: 'todas',
    editing: null,            // null | 'new' | id de tarea
    draft: null,
    animate: new Set(),
    pinAnim: new Set(),
    justAdded: null,
    linger: new Map(),
    minuteKey: '',
  };

  let swipe = null;              // gesto de deslizar en curso
  let suppressClickUntil = 0;    // evita que un deslizamiento cuente también como toque
  let renderDeferred = false;    // hubo cambios mientras se deslizaba o movía una tarjeta
  let press = null;              // pulsación larga esperando a cumplirse
  let drag = null;               // tarea que se está moviendo de lugar
  let dropping = false;          // la tarea movida está aterrizando en su nuevo lugar

  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const savedFilter = lsGet(LS_FILTER);
  if (savedFilter === 'pendientes' || savedFilter === 'tachadas' || savedFilter === 'todas') S.filter = savedFilter;

  const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(reduceMQ && reduceMQ.matches);

  /* ---------- Utilidades ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const shift = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const newId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function dateLabel(s, today) {
    if (s === today) return 'Hoy';
    if (s === shift(today, 1)) return 'Mañana';
    if (s === shift(today, -1)) return 'Ayer';
    const d = parseYmd(s);
    const base = DIAS_C[d.getDay()] + ' ' + d.getDate() + ' ' + MESES_C[d.getMonth()];
    return d.getFullYear() === parseYmd(today).getFullYear() ? base : base + ' ' + d.getFullYear();
  }
  function fmtTime(t) {
    let [h, m] = t.split(':').map(Number);
    const pm = h >= 12; h = h % 12 || 12;
    return h + ':' + pad(m) + (pm ? ' p. m.' : ' a. m.');
  }
  function suggestEmoji(text) {
    const s = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const [e, re] of KEYWORDS) if (re.test(s)) return e;
    return '';
  }

  /* ---------- Reglas de las tareas ---------- */
  const isDone = (t, today) => t.repeat === 'diaria' ? (t.done && t.doneOn === today) : t.done;
  function overdue(t, ctx) {
    const none = { date: false, time: false };
    if (isDone(t, ctx.today)) return none;
    if (t.repeat === 'diaria') return { date: false, time: !!t.time && toMin(t.time) < ctx.nowMin };
    if (t.date && t.date < ctx.today) return { date: true, time: false };
    if (t.date === ctx.today && t.time && toMin(t.time) < ctx.nowMin) return { date: false, time: true };
    return none;
  }
  function matchFilter(t, today) {
    if (S.filter === 'pendientes') return !isDone(t, today);
    if (S.filter === 'tachadas') return isDone(t, today);
    return true;
  }
  // Las fijadas van primero (la última fijada arriba); el resto, en su orden.
  const byOrder = (a, b) =>
    (Number(b.pinned) - Number(a.pinned)) ||
    (a.pinned ? b.pinnedAt - a.pinnedAt : 0) ||
    (a.order - b.order) || (b.createdAt - a.createdAt) || (a.id < b.id ? -1 : 1);

  function normalize(id, x) {
    const str = (v, n) => (typeof v === 'string' ? v : '').slice(0, n);
    return {
      id,
      title: str(x.title, 300).trim() || 'Tarea sin nombre',
      emoji: str(x.emoji, 16),
      color: COLORS.includes(x.color) ? x.color : 'azul',
      priority: PRIO_KEYS.includes(x.priority) ? x.priority : '',
      date: DATE_RE.test(x.date) ? x.date : '',
      time: TIME_RE.test(x.time) ? x.time : '',
      repeat: x.repeat === 'diaria' ? 'diaria' : '',
      done: x.done === true,
      doneOn: DATE_RE.test(x.doneOn) ? x.doneOn : '',
      order: Number.isFinite(x.order) ? x.order : 0,
      createdAt: Number.isFinite(x.createdAt) ? x.createdAt : 0,
      example: x.example === true,
      pinned: x.pinned === true,
      pinnedAt: Number.isFinite(x.pinnedAt) ? x.pinnedAt : 0,
    };
  }
  function toDoc(t) {
    return { title: t.title, emoji: t.emoji, color: t.color, priority: t.priority, date: t.date, time: t.time,
      repeat: t.repeat, done: t.done, doneOn: t.doneOn, order: t.order, createdAt: t.createdAt, example: t.example,
      pinned: t.pinned, pinnedAt: t.pinnedAt };
  }
  function tasksView() {
    if (!S.pending.size) return S.server;
    const m = new Map(S.server);
    for (const [id, t] of S.pending) { if (t) m.set(id, t); else m.delete(id); }
    return m;
  }

  /* ---------- Guardado ---------- */
  function saveLocal() { lsSet(LS_TASKS, JSON.stringify(Array.from(S.server.values()))); }

  function mutate(id, next) {
    if (S.mode === 'local') {
      if (next) S.server.set(id, next); else S.server.delete(id);
      saveLocal();
    } else if (S.mode === 'db') {
      S.pending.set(id, next);
      persist(id);
    }
  }

  // Una escritura a la vez por tarea, con un máximo de 4 tareas escribiéndose a la vez.
  const writers = new Map();
  let active = 0;
  const waiting = [];
  const takeSlot = () => new Promise(res => { if (active < 4) { active++; res(); } else waiting.push(res); });
  const freeSlot = () => { const next = waiting.shift(); if (next) next(); else active--; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function writeOnce(id, t) {
    const ref = S.db.collection('tasks').doc(id);
    if (t) await ref.set(toDoc(t)); else await ref.delete();
  }
  async function persist(id) {
    let w = writers.get(id);
    if (!w) { w = { busy: false, dirty: false }; writers.set(id, w); }
    if (w.busy) { w.dirty = true; return; }
    w.busy = true;
    try {
      do {
        w.dirty = false;
        if (!S.pending.has(id)) break;
        const t = S.pending.get(id);
        await takeSlot();
        let failed = null;
        try {
          try { await writeOnce(id, t); }
          catch (e) {
            if (e && e.code === 'unavailable') { await sleep(300 + Math.random() * 600); await writeOnce(id, t); }
            else throw e;
          }
        } catch (e) { failed = e; }
        finally { freeSlot(); }
        if (failed) { S.pending.delete(id); onWriteError(failed); renderAll(); break; }
        if (!w.dirty && S.pending.get(id) === t) S.pending.delete(id);
      } while (w.dirty);
    } finally { w.busy = false; }
  }
  function onWriteError(e) {
    const code = e && e.code;
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked') {
      S.canWrite = false; closeEditor(true);
      toast('No puedes cambiar esta lista; solo verla.');
    } else if (code === 'quota_exceeded') {
      toast('Tu lista llegó a su límite. Limpia las tachadas para seguir agregando.');
    } else if (code === 'resource_exhausted') {
      toast('Demasiados cambios seguidos. Espera unos segundos y vuelve a intentarlo.');
    } else {
      toast('No se pudo guardar el cambio. Revisa tu conexión e inténtalo otra vez.');
    }
  }

  /* ---------- Acciones ---------- */
  const lingerTimers = new Map();
  function toggle(id) {
    if (!S.canWrite || S.mode === 'loading') return;
    const t = tasksView().get(id); if (!t) return;
    const today = ymd(new Date());
    const wasDone = isDone(t, today);
    const next = Object.assign({}, t, { done: !wasDone, doneOn: wasDone ? '' : today });
    if (!wasDone) S.animate.add(id);
    if (S.filter !== 'todas') {
      // La tarjeta se queda un momento para que se vea el tachado antes de salir del filtro.
      S.linger.set(id, true);
      clearTimeout(lingerTimers.get(id));
      lingerTimers.set(id, setTimeout(() => { S.linger.delete(id); lingerTimers.delete(id); renderAll(); }, 1400));
    }
    mutate(id, next);
    renderAll();
    if (!wasDone) {
      const view = tasksView();
      let all = view.size > 0;
      for (const x of view.values()) if (!isDone(x, today)) { all = false; break; }
      if (all) celebrate();
    }
  }

  function removeTask(id) {
    const prev = tasksView().get(id); if (!prev) return;
    if (S.editing === id) closeEditor(true);
    mutate(id, null);
    renderAll();
    toast('Tarea eliminada', 'Deshacer', () => { S.justAdded = id; mutate(id, prev); renderAll(); });
  }
  function togglePin(id) {
    if (!S.canWrite || S.mode === 'loading') return;
    const t = tasksView().get(id); if (!t) return;
    const pin = !t.pinned;
    if (pin) S.pinAnim.add(id);
    mutate(id, Object.assign({}, t, { pinned: pin, pinnedAt: pin ? Date.now() : 0 }));
    renderAll({ flip: true });
    toast(pin ? 'Tarea fijada arriba' : 'Tarea desfijada');
  }

  // Guarda el nuevo lugar de una tarea. `ids` es el orden visible de su grupo (fijadas o no) ya con la
  // tarea en su sitio. Solo cambia esa tarea: queda entre sus vecinos, aunque haya ocultas por el filtro.
  function commitReorder(id, ids) {
    const view = tasksView();
    const t = view.get(id); if (!t) return;
    const pinned = !!t.pinned;
    const key = x => pinned ? -x.pinnedAt : x.order;
    const full = Array.from(view.values()).filter(x => !!x.pinned === pinned && x.id !== id).sort(byOrder);
    const pos = ids.indexOf(id);
    const above = pos > 0 ? ids[pos - 1] : null;
    const below = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null;
    let at = -1;
    if (above) { const i = full.findIndex(x => x.id === above); if (i >= 0) at = i + 1; }
    else if (below) at = full.findIndex(x => x.id === below);
    if (at < 0) return;
    const lo = at > 0 ? key(full[at - 1]) : null;
    const hi = at < full.length ? key(full[at]) : null;
    let k;
    if (lo === null && hi === null) return;
    if (lo === null) k = hi - 1;
    else if (hi === null) k = lo + 1;
    else if (hi - lo > 1e-6) k = (lo + hi) / 2;
    else {
      // Sin espacio entre los vecinos: se renumera el grupo completo.
      const seq = full.slice(); seq.splice(at, 0, t);
      const base = Date.now();
      seq.forEach((x, i) => {
        const patch = pinned ? { pinnedAt: base - i } : { order: i };
        if ((pinned ? x.pinnedAt : x.order) !== (pinned ? patch.pinnedAt : patch.order)) mutate(x.id, Object.assign({}, x, patch));
      });
      return;
    }
    mutate(id, Object.assign({}, t, pinned ? { pinnedAt: -k } : { order: k }));
  }
  function groupIds(t) {
    const view = tasksView();
    return Array.from($('#list').children)
      .filter(el => el.classList.contains('item') && !el.classList.contains('leaving') &&
        view.has(el.dataset.id) && !!view.get(el.dataset.id).pinned === !!t.pinned)
      .map(el => el.dataset.id);
  }
  // Teclado (computadora): Alt + ↑/↓ sobre una tarea la sube o la baja un lugar.
  function moveBy(id, dir) {
    if (!S.canWrite || S.mode === 'loading') return;
    const t = tasksView().get(id); if (!t) return;
    const ids = groupIds(t);
    const i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    ids.splice(i, 1); ids.splice(j, 0, id);
    commitReorder(id, ids);
    renderAll({ flip: true });
    const item = cardEls.get(id), m = item && item.querySelector('.t-main');
    if (m) m.focus();
  }
  function removeMany(list, msg) {
    if (!list.length) return;
    list.forEach(t => mutate(t.id, null));
    renderAll();
    toast(msg, 'Deshacer', () => { list.forEach(t => mutate(t.id, t)); renderAll(); });
  }
  function clearDone() {
    const today = ymd(new Date());
    const gone = Array.from(tasksView().values()).filter(t => t.repeat !== 'diaria' && isDone(t, today));
    removeMany(gone, gone.length === 1 ? 'Se limpió 1 tarea tachada' : 'Se limpiaron ' + gone.length + ' tareas tachadas');
  }
  function clearExamples() {
    const gone = Array.from(tasksView().values()).filter(t => t.example);
    removeMany(gone, gone.length === 1 ? 'Ejemplo borrado' : 'Ejemplos borrados');
  }

  function celebrate() {
    const ring = $('#ring');
    if (reduced() || !ring.animate) return;
    ring.classList.remove('pulse'); void ring.offsetWidth; ring.classList.add('pulse');
    const inks = ['--naranja-ink', '--verde-ink', '--azul-ink', '--lila-ink', '--amarillo-ink'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.style.background = 'var(' + inks[i % inks.length] + ')';
      ring.appendChild(s);
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const d = 34 + Math.random() * 22;
      const anim = s.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: 'translate(' + (Math.cos(a) * d).toFixed(1) + 'px, ' + (Math.sin(a) * d).toFixed(1) + 'px) scale(.35)', opacity: 0 },
      ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2, .7, .3, 1)' });
      anim.onfinish = () => s.remove();
    }
  }

  /* ---------- Editor ---------- */
  let composerEl = null;

  function nextColor(view) {
    const count = {}; COLORS.forEach(c => { count[c] = 0; });
    for (const t of view.values()) count[t.color]++;
    const top = Array.from(view.values()).sort(byOrder)[0];
    const start = top ? (COLORS.indexOf(top.color) + 1) % COLORS.length : 2;
    let best = null;
    for (let i = 0; i < COLORS.length; i++) {
      const c = COLORS[(start + i) % COLORS.length];
      if (best === null || count[c] < count[best]) best = c;
    }
    return best;
  }

  function openComposer() {
    if (!S.canWrite || S.mode === 'loading') return;
    if (S.editing === 'new') { focusEditor(); return; }
    closeEditor(true);
    S.editing = 'new';
    S.draft = { title: '', emoji: '', emojiManual: false, color: nextColor(tasksView()), priority: '', date: '', time: '', repeat: false, pinned: false };
    if (S.filter === 'tachadas') { S.filter = 'todas'; lsSet(LS_FILTER, S.filter); }
    renderAll({ instant: true });
    focusEditor();
  }
  function openEditor(id) {
    if (!S.canWrite || S.mode === 'loading') return;
    const t = tasksView().get(id); if (!t) return;
    closeEditor(true);
    S.editing = id;
    S.draft = { title: t.title, emoji: t.emoji, emojiManual: true, color: t.color, priority: t.priority, date: t.date, time: t.time, repeat: t.repeat === 'diaria', pinned: t.pinned };
    renderAll({ instant: true });
    focusEditor();
  }
  function closeEditor(silent) {
    if (S.editing === null) return;
    const id = S.editing;
    S.editing = null; S.draft = null;
    if (id === 'new') { if (composerEl) { composerEl.remove(); composerEl = null; } }
    else { const item = cardEls.get(id); if (item) { item.classList.remove('editing'); item.dataset.sig = ''; } }
    if (!silent) {
      renderAll({ instant: true });
      const item = id !== 'new' && cardEls.get(id);
      const m = item && item.querySelector('.t-main');
      if (m) m.focus({ preventScroll: true });
    }
  }
  function editorRoot() {
    if (S.editing === 'new') return composerEl;
    const item = cardEls.get(S.editing);
    return item ? item._face : null;
  }
  function focusEditor() {
    const root = editorRoot();
    if (!root) return;
    const ta = root.querySelector('.ed-title'); if (!ta) return;
    if (root._grow) root._grow();
    try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    try { const n = ta.value.length; ta.setSelectionRange(n, n); } catch (e) { /* no-op */ }
    root.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }

  function saveDraft() {
    const d = S.draft; if (!d) return;
    const root = editorRoot();
    const title = d.title.replace(/\s+/g, ' ').trim();
    if (!title) {
      const hint = root && root.querySelector('.ed-hint'); if (hint) hint.hidden = false;
      const ta = root && root.querySelector('.ed-title');
      if (ta) {
        ta.focus();
        if (!reduced() && ta.animate) ta.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
      }
      return;
    }
    const today = ymd(new Date());
    const base = { title, emoji: d.emoji, color: d.color, priority: d.priority, date: d.repeat ? '' : d.date, time: d.time, repeat: d.repeat ? 'diaria' : '', pinned: !!d.pinned };
    if (S.editing === 'new') {
      const view = tasksView();
      let min = 1;
      for (const t of view.values()) if (t.order < min) min = t.order;
      const id = newId();
      const t = Object.assign({ id }, base, { pinnedAt: d.pinned ? Date.now() : 0, done: false, doneOn: '', order: min - 1, createdAt: Date.now(), example: false });
      closeEditor(true);
      S.justAdded = id;
      markPastAlert(t);
      mutate(id, t);
      renderAll();
    } else {
      const id = S.editing;
      const prev = tasksView().get(id);
      if (!prev) { closeEditor(); return; }
      const wasDone = isDone(prev, today);
      const pinnedAt = d.pinned ? (prev.pinned ? prev.pinnedAt : Date.now()) : 0;
      const t = Object.assign({}, prev, base, { pinnedAt, example: false, done: wasDone, doneOn: wasDone ? (prev.doneOn || today) : '' });
      if (d.pinned && !prev.pinned) S.pinAnim.add(id);
      closeEditor(true);
      markPastAlert(t);
      mutate(id, t);
      renderAll({ flip: !!d.pinned !== !!prev.pinned });
      const item = cardEls.get(id); const m = item && item.querySelector('.t-main');
      if (m) m.focus({ preventScroll: true });
    }
  }

  function whenMode(d) {
    if (d.repeat) return 'diaria';
    const today = ymd(new Date()), tomorrow = shift(today, 1);
    return d.date === '' ? 'none' : d.date === today ? 'hoy' : d.date === tomorrow ? 'manana' : 'otra';
  }

  function editorHTML(d, key, isNew) {
    const mode = whenMode(d);
    const sw = COLORS.map(c => `<button type="button" role="radio" class="sw c-${c}" data-color="${c}" aria-checked="${c === d.color}" aria-label="${COLOR_NAMES[c]}">${ic('check')}</button>`).join('');
    const pr = PRIOS.map(([v, l]) => `<button type="button" role="radio" class="opt" data-prio="${v}" aria-checked="${v === d.priority}">${l}</button>`).join('');
    const em = EMOJIS.map(e => `<button type="button" data-emoji="${e}" aria-pressed="${e === d.emoji}">${e}</button>`).join('');
    return `<form class="editor" novalidate>
      <div class="ed-top">
        <button type="button" class="ed-emoji" aria-label="Elegir emoji" aria-expanded="false">${d.emoji ? esc(d.emoji) : ic('smile')}</button>
        <label class="sr" for="ed-title-${key}">Tarea</label>
        <textarea id="ed-title-${key}" class="ed-title" rows="1" maxlength="140" autocomplete="off" enterkeyhint="done" placeholder="¿Qué tienes que hacer?">${esc(d.title)}</textarea>
        <button type="button" class="ed-pin" aria-pressed="${!!d.pinned}" aria-label="Fijar arriba">${ic('pin')}</button>
      </div>
      <p class="ed-hint" hidden>Escribe la tarea primero.</p>
      <div class="ed-tray" hidden>${em}<button type="button" class="none" data-emoji="" aria-pressed="${!d.emoji}">Sin</button></div>
      <div class="ed-sec">
        <span class="ed-label" id="lb-color-${key}">Color</span>
        <div class="ed-row" role="radiogroup" aria-labelledby="lb-color-${key}">${sw}</div>
      </div>
      <div class="ed-sec">
        <span class="ed-label" id="lb-prio-${key}">Prioridad</span>
        <div class="ed-row" role="radiogroup" aria-labelledby="lb-prio-${key}">${pr}</div>
      </div>
      <div class="ed-sec">
        <span class="ed-label" id="lb-when-${key}">Cuándo</span>
        <div class="ed-row" role="group" aria-labelledby="lb-when-${key}">
          <button type="button" class="opt" data-when="none" aria-pressed="${mode === 'none'}">Sin fecha</button>
          <button type="button" class="opt" data-when="hoy" aria-pressed="${mode === 'hoy'}">Hoy</button>
          <button type="button" class="opt" data-when="manana" aria-pressed="${mode === 'manana'}">Mañana</button>
          <button type="button" class="opt" data-when="diaria" aria-pressed="${mode === 'diaria'}">${ic('repeat')}Cada día</button>
        </div>
        <div class="ed-row">
          <label class="fw fw-date${mode === 'otra' ? ' on' : ''}"${mode === 'diaria' ? ' hidden' : ''}>${ic('cal')}<input type="date" class="fin" id="ed-date-${key}" aria-label="Otra fecha" value="${mode === 'otra' ? d.date : ''}"></label>
          <label class="fw fw-time${d.time ? ' on' : ''}">${ic('clock')}<input type="time" class="fin" id="ed-time-${key}" aria-label="Hora" value="${d.time}"></label>
          <button type="button" class="ed-x ed-notime" aria-label="Quitar hora"${d.time ? '' : ' hidden'}>${ic('x')}</button>
          <button type="button" class="opt ed-cal"${d.time ? '' : ' hidden'}>${ic('alarm')}Alarma en el calendario</button>
        </div>
      </div>
      <div class="ed-actions">
        ${isNew ? '' : `<button type="button" class="btn-del" data-act="del">${ic('trash')}Eliminar</button>`}
        <span class="spacer"></span>
        <button type="button" class="btn-ghost" data-act="cancel">Cancelar</button>
        <button type="submit" class="btn-save">${isNew ? 'Agregar' : 'Guardar'}</button>
      </div>
    </form>`;
  }

  function bindEditor(root, isNew) {
    const ta = root.querySelector('.ed-title');
    const tray = root.querySelector('.ed-tray');
    const eb = root.querySelector('.ed-emoji');
    const hint = root.querySelector('.ed-hint');
    const dateWrap = root.querySelector('.fw-date');
    const timeWrap = root.querySelector('.fw-time');
    const dateIn = root.querySelector('input[type="date"]');
    const timeIn = root.querySelector('input[type="time"]');
    const noTime = root.querySelector('.ed-notime');
    const pinBtn = root.querySelector('.ed-pin');
    const calBtn = root.querySelector('.ed-cal');

    const sync = () => {
      const d = S.draft; if (!d) return;
      root.className = root.className.replace(/\bc-[a-z]+\b/, 'c-' + d.color);
      root.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.color === d.color)));
      root.querySelectorAll('[data-prio]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.prio === d.priority)));
      const mode = whenMode(d);
      root.querySelectorAll('[data-when]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.when === mode)));
      dateWrap.hidden = mode === 'diaria';
      dateWrap.classList.toggle('on', mode === 'otra');
      if (mode !== 'otra' && dateIn.value) dateIn.value = '';
      timeWrap.classList.toggle('on', !!d.time);
      noTime.hidden = !d.time;
      calBtn.hidden = !d.time;
      pinBtn.setAttribute('aria-pressed', String(!!d.pinned));
      eb.innerHTML = d.emoji ? esc(d.emoji) : ic('smile');
      tray.querySelectorAll('[data-emoji]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.emoji === d.emoji)));
    };
    const grow = () => { ta.style.height = 'auto'; if (ta.scrollHeight) ta.style.height = ta.scrollHeight + 'px'; };

    ta.addEventListener('input', () => {
      if (!S.draft) return;
      S.draft.title = ta.value;
      grow();
      hint.hidden = true;
      if (isNew && !S.draft.emojiManual) {
        const s = suggestEmoji(ta.value);
        if (s !== S.draft.emoji) { S.draft.emoji = s; sync(); }
      }
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); saveDraft(); }
    });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeEditor(); } });
    root.addEventListener('click', e => {
      const b = e.target.closest('button');
      const d = S.draft;
      if (!b || !root.contains(b) || !d) return;
      if (b === eb) { const open = tray.hidden; tray.hidden = !open; eb.setAttribute('aria-expanded', String(open)); return; }
      if (tray.contains(b) && b.dataset.emoji !== undefined) {
        d.emoji = b.dataset.emoji; d.emojiManual = true;
        tray.hidden = true; eb.setAttribute('aria-expanded', 'false');
        sync(); return;
      }
      if (b.dataset.color) { d.color = b.dataset.color; sync(); return; }
      if (b.dataset.prio !== undefined) { d.priority = b.dataset.prio; sync(); return; }
      if (b.dataset.when) {
        const today = ymd(new Date()), w = b.dataset.when;
        d.repeat = w === 'diaria';
        d.date = w === 'hoy' ? today : w === 'manana' ? shift(today, 1) : '';
        sync(); return;
      }
      if (b === noTime) { d.time = ''; timeIn.value = ''; sync(); return; }
      if (b === pinBtn) { d.pinned = !d.pinned; sync(); return; }
      if (b === calBtn) {
        addToCalendar({ id: S.editing === 'new' ? '' : S.editing, title: d.title.replace(/\s+/g, ' ').trim() || 'Tarea',
          emoji: d.emoji, time: d.time, date: d.repeat ? '' : d.date, repeat: d.repeat ? 'diaria' : '' });
        return;
      }
      if (b.dataset.act === 'cancel') { closeEditor(); return; }
      if (b.dataset.act === 'del') { removeTask(S.editing); }
    });
    dateIn.addEventListener('change', () => {
      if (!S.draft) return;
      S.draft.repeat = false;
      S.draft.date = DATE_RE.test(dateIn.value) ? dateIn.value : '';
      sync();
    });
    const onTime = () => { if (!S.draft) return; S.draft.time = TIME_RE.test(timeIn.value) ? timeIn.value : ''; timeWrap.classList.toggle('on', !!S.draft.time); noTime.hidden = !S.draft.time; calBtn.hidden = !S.draft.time; };
    timeIn.addEventListener('input', onTime);
    timeIn.addEventListener('change', onTime);
    root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); saveDraft(); });
    root._grow = grow;
  }

  function ensureComposer() {
    if (!composerEl) {
      composerEl = document.createElement('article');
      composerEl.id = 'composer';
      composerEl.className = 'task editor-card editing c-' + S.draft.color + (reduced() ? '' : ' enter');
      composerEl.innerHTML = editorHTML(S.draft, 'nueva', true);
      bindEditor(composerEl, true);
    }
    return composerEl;
  }
  function openEditorIn(item, t) {
    const face = item._face;
    item.classList.add('editing');
    face.removeAttribute('style');
    face.className = 'task editor-card c-' + S.draft.color;
    face.innerHTML = editorHTML(S.draft, t.id, false);
    bindEditor(face, false);
    item.dataset.sig = '';
  }

  /* ---------- Tarjetas ---------- */
  const cardEls = new Map();

  function signature(t, ctx) {
    const od = overdue(t, ctx);
    return [t.title, t.emoji, t.color, t.priority, t.date, t.time, t.repeat, isDone(t, ctx.today), od.date, od.time,
      t.example, t.pinned, t.date ? dateLabel(t.date, ctx.today) : '', ctx.canWrite].join('\u0001');
  }

  function paintCard(el, t, ctx) {
    const done = isDone(t, ctx.today);
    const od = overdue(t, ctx);
    const a = document.activeElement;
    const keepFocus = a && el.contains(a) ? (a.closest('.check') ? '.check' : '.t-main') : null;
    const justDone = done && S.animate.has(t.id);
    const justPinned = t.pinned && S.pinAnim.has(t.id);
    el.className = 'task c-' + t.color + (done ? ' is-done' : '') + (t.pinned ? ' is-pinned' : '') +
      (justDone ? ' just-done' : '') + (justPinned ? ' just-pinned' : '');
    // Se quitan al terminar la animación para que no se repita si la fila cambia de lugar.
    if (justDone) setTimeout(() => el.classList.remove('just-done'), 1000);
    if (justPinned) setTimeout(() => el.classList.remove('just-pinned'), 800);
    const chips = [];
    if (t.repeat === 'diaria') chips.push('<span class="chip">' + ic('repeat') + 'Diaria</span>');
    else if (t.date) chips.push('<span class="chip' + (od.date ? ' warn' : '') + '">' + ic('cal') + (od.date ? 'Atrasada · ' : '') + esc(dateLabel(t.date, ctx.today)) + '</span>');
    if (t.time) chips.push('<span class="chip' + (od.time ? ' warn' : '') + '">' + ic('clock') + esc(fmtTime(t.time)) + '</span>');
    if (t.example) chips.push('<span class="chip chip-ex">Ejemplo</span>');
    const end = done
      ? '<span class="stamp">¡Listo!</span>'
      : t.priority ? '<span class="prio prio-' + t.priority + '">' + PRIO_LABEL[t.priority] + '</span>' : '';
    const title = esc(t.title);
    const can = ctx.canWrite;
    el.innerHTML =
      (t.pinned ? '<span class="pin-badge">' + ic('pin', 'fill') + '</span>' : '') +
      '<button class="check" type="button" role="checkbox" aria-checked="' + done + '" aria-label="' + title + '"' + (can ? '' : ' disabled') + '>' +
        '<span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 12.6l3.7 3.7 7.6-8"/></svg></span>' +
      '</button>' +
      '<div class="t-main"' + (can ? ' role="button" tabindex="0"' : '') + '>' +
        (can ? '<span class="sr">Editar: </span>' : '') +
        (t.pinned ? '<span class="sr">Fijada. </span>' : '') +
        '<p class="t-title">' + (t.emoji ? '<span class="t-emoji" aria-hidden="true">' + esc(t.emoji) + '</span> ' : '') + '<span class="t-text">' + title + '</span></p>' +
        ((chips.length || end) ? '<div class="t-meta">' + chips.join('') + (end ? '<span class="t-end">' + end + '</span>' : '') + '</div>' : '') +
      '</div>';
    if (keepFocus) { const n = el.querySelector(keepFocus); if (n) n.focus({ preventScroll: true }); }
  }

  // El tachado: un trazo de marcador por cada línea del texto, dibujado con un leve temblor de mano.
  function drawStrike(item, animate) {
    const face = item._face || item;
    if (!item.isConnected || item.classList.contains('editing') || !face.classList.contains('is-done')) return;
    const wrap = face.querySelector('.t-title'), text = face.querySelector('.t-text');
    if (!wrap || !text) return;
    const old = wrap.querySelector('.strike'); if (old) old.remove();
    const wr = wrap.getBoundingClientRect();
    if (!wr.width || !wr.height) return;
    const kx = wrap.offsetWidth / wr.width || 1, ky = wrap.offsetHeight / wr.height || 1;
    const lines = [];
    for (const r of text.getClientRects()) {
      if (r.width < 2) continue;
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.top - r.top) < 4) { last.l = Math.min(last.l, r.left); last.r = Math.max(last.r, r.right); }
      else lines.push({ l: r.left, r: r.right, top: r.top, b: r.bottom });
    }
    if (!lines.length) return;
    const fs = parseFloat(getComputedStyle(text).fontSize) || 16;
    const seed = hash(item.dataset.id || 'x');
    const jit = n => (((seed >>> (n % 27)) & 15) / 15) - 0.5;
    const r1 = v => Math.round(v * 10) / 10;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'strike');
    svg.setAttribute('aria-hidden', 'true');
    lines.forEach((ln, i) => {
      const x1 = (ln.l - wr.left) * kx - 3, x2 = (ln.r - wr.left) * kx + 3, w = x2 - x1;
      const y = ((ln.top + ln.b) / 2 - wr.top) * ky + fs * 0.08;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + r1(x1) + ' ' + r1(y + jit(i * 4) * 1.6) +
        ' C' + r1(x1 + w * 0.3) + ' ' + r1(y - 1.7 + jit(i * 4 + 1)) +
        ' ' + r1(x1 + w * 0.7) + ' ' + r1(y + 1.7 + jit(i * 4 + 2)) +
        ' ' + r1(x2) + ' ' + r1(y - 0.6 + jit(i * 4 + 3) * 1.4));
      svg.appendChild(p);
    });
    wrap.appendChild(svg);
    if (animate && !reduced() && typeof svg.animate === 'function') {
      let delay = 90;
      for (const p of svg.querySelectorAll('path')) {
        const L = p.getTotalLength ? p.getTotalLength() : 300;
        p.style.strokeDasharray = L + ' ' + L;
        const dur = Math.max(180, Math.min(440, 120 + L * 1.4));
        p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: dur, delay, easing: 'cubic-bezier(.6, .05, .25, 1)', fill: 'backwards' });
        delay += dur * 0.9;
      }
    }
  }
  function redrawStrikes() { for (const el of cardEls.values()) drawStrike(el, false); }

  function animateOut(item) {
    if (typeof item.animate !== 'function') { item.remove(); return; }
    item.classList.add('leaving');
    const h = item.offsetHeight;
    const a = item.animate([
      { height: h + 'px', opacity: 1, marginBottom: '0px' },
      { height: '0px', opacity: 0, marginBottom: '-12px' },
    ], { duration: 260, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    a.onfinish = () => item.remove();
    a.oncancel = () => item.remove();
  }

  /* ---------- Pintado ---------- */
  function renderList(view, ctx, opts) {
    // Mientras una tarea se mueve, la lista no se toca; se pone al día al soltarla.
    if (drag || dropping) { renderDeferred = true; return; }
    const list = $('#list');
    const all = Array.from(view.values()).sort(byOrder);
    const visible = all.filter(t => S.editing === t.id || S.linger.has(t.id) || matchFilter(t, ctx.today));
    const want = new Set(visible.map(t => t.id));

    // Posiciones de antes, para animar el cambio de orden (al fijar o desfijar).
    let first = null;
    if (opts.flip && !reduced()) {
      first = new Map();
      for (const item of cardEls.values()) if (item.isConnected) first.set(item, item.getBoundingClientRect().top);
    }

    for (const [id, item] of Array.from(cardEls)) {
      if (want.has(id)) continue;
      cardEls.delete(id);
      if (opts.instant || reduced() || !item.isConnected) item.remove(); else animateOut(item);
    }

    const seq = [], strikes = [];
    if (S.editing === 'new' && S.draft) seq.push(ensureComposer());
    for (const t of visible) {
      let item = cardEls.get(t.id);
      if (!item) {
        item = document.createElement('div');
        item.className = 'item';
        item.dataset.id = t.id;
        item._face = document.createElement('article');
        item.appendChild(item._face);
        cardEls.set(t.id, item);
        if (S.justAdded === t.id && !reduced()) {
          item.classList.add('enter');
          setTimeout(() => item.classList.remove('enter'), 420);
        }
      }
      if (swipe && swipe.item === item) {
        // No se repinta bajo el dedo: se perdería el gesto. Se pone al día al soltar.
        renderDeferred = true;
      } else if (S.editing === t.id && S.draft) {
        if (!item.classList.contains('editing')) openEditorIn(item, t);
      } else {
        const sig = signature(t, ctx);
        if (item.dataset.sig !== sig) {
          paintCard(item._face, t, ctx);
          item.dataset.sig = sig;
          if (isDone(t, ctx.today)) strikes.push([item, S.animate.has(t.id)]);
        }
      }
      seq.push(item);
    }

    let cur = list.firstElementChild;
    for (const el of seq) {
      while (cur && cur !== el && cur.classList.contains('leaving')) cur = cur.nextElementSibling;
      if (cur === el) { cur = el.nextElementSibling; continue; }
      list.insertBefore(el, cur);
    }

    if (first) {
      for (const [item, top0] of first) {
        if (!item.isConnected || item.classList.contains('leaving')) continue;
        const dy = top0 - item.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) {
          item.animate([{ transform: 'translateY(' + dy.toFixed(1) + 'px)' }, { transform: 'translateY(0)' }],
            { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' });
        }
      }
    }

    const showEmpty = !visible.length && S.editing !== 'new';
    $('#empty').hidden = !showEmpty;
    if (showEmpty) {
      let t1, t2;
      if (S.mode === 'loading') { t1 = 'Cargando tu lista…'; t2 = 'Aquí aparecerán tus tareas. Toca «Nueva tarea» para anotar la primera.'; }
      else if (!view.size) {
        t1 = 'Aquí aparecerán tus tareas';
        t2 = S.canWrite ? 'Toca «Nueva tarea» para anotar la primera. Cuando la termines, márcala y quedará tachada.' : 'Esta lista todavía no tiene tareas.';
      } else if (S.filter === 'pendientes') { t1 = 'Nada pendiente'; t2 = 'Todo está tachado. Si surge algo más, toca «Nueva tarea».'; }
      else { t1 = 'Todavía no tachas nada'; t2 = 'Marca una tarea cuando la termines y aparecerá aquí.'; }
      $('#empty-title').textContent = t1;
      $('#empty-sub').textContent = t2;
    }

    S.animate.clear();
    S.pinAnim.clear();
    S.justAdded = null;
    if (strikes.length) requestAnimationFrame(() => strikes.forEach(([el, anim]) => drawStrike(el, anim)));
  }

  function summary(total, done) {
    const p = total - done;
    if (!total) return 'Sin tareas por ahora';
    if (!p) return total === 1 ? 'Tachaste tu única tarea' : 'Tachaste las ' + total + ' tareas';
    return p + (p === 1 ? ' pendiente' : ' pendientes') + ' · ' + done + (done === 1 ? ' tachada' : ' tachadas');
  }

  function renderAll(opts) {
    opts = opts || {};
    const view = tasksView();
    const now = new Date();
    const today = ymd(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    S.minuteKey = today + '|' + nowMin;
    const loading = S.mode === 'loading';
    const ctx = { today, nowMin, canWrite: S.canWrite && !loading };

    $('#fecha').textContent = 'Hoy, ' + DIAS[now.getDay()] + ' ' + now.getDate() + ' de ' + MESES[now.getMonth()];

    let total = 0, done = 0, examples = 0, clearable = 0, daily = 0;
    for (const t of view.values()) {
      total++;
      const d = isDone(t, today);
      if (d) done++;
      if (t.example) examples++;
      if (d && t.repeat !== 'diaria') clearable++;
      if (t.repeat === 'diaria') daily++;
    }

    $('#ring-bar').style.strokeDashoffset = String(RING_C * (1 - (total ? done / total : 0)));
    $('#ring-num').textContent = loading ? '–' : (total ? done + '/' + total : '0');
    $('#ring').setAttribute('aria-label', loading ? 'Cargando avance' : done + ' de ' + total + ' tareas tachadas');
    $('#sum').textContent = loading ? 'Cargando tu lista…' : summary(total, done);

    const add = $('#add');
    add.hidden = !S.canWrite;
    add.disabled = !ctx.canWrite;

    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === S.filter)));
    $('#n-todas').textContent = total;
    $('#n-pendientes').textContent = total - done;
    $('#n-tachadas').textContent = done;

    $('#banner').hidden = !(examples > 0 && ctx.canWrite);
    $('#limpiar').hidden = !(clearable > 0 && ctx.canWrite);
    $('#limpiar-n').textContent = clearable;
    $('#nota-diaria').hidden = !daily;
    $('#nota-gestos').hidden = !(total > 0 && ctx.canWrite);
    const nm = $('#nota-modo');
    if (S.mode === 'local') { nm.hidden = true; }
    else if (S.mode === 'db' && !S.canWrite) { nm.hidden = false; nm.textContent = 'Solo puedes ver esta lista; no puedes cambiarla.'; }
    else nm.hidden = true;

    renderList(view, ctx, opts);
    updateFab();
    renderAlertsPanel();
  }

  /* ---------- Aviso flotante ---------- */
  let toastTimer = 0;
  function toast(msg, actLabel, onAct) {
    const el = $('#toast'), m = $('#toast-msg'), b = $('#toast-act');
    m.textContent = msg;
    if (actLabel) { b.hidden = false; b.textContent = actLabel; b.onclick = () => { hideToast(); onAct(); }; }
    else { b.hidden = true; b.onclick = null; }
    el.hidden = false;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actLabel ? 6500 : 4500);
  }
  function hideToast() { clearTimeout(toastTimer); $('#toast').hidden = true; }

  /* ---------- Botón flotante ---------- */
  let addOnScreen = true;
  function updateFab() {
    const show = !addOnScreen && S.canWrite && S.mode !== 'loading' && S.editing === null;
    $('#fab').hidden = !show;
    document.body.classList.toggle('fab-on', show);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { addOnScreen = es[es.length - 1].isIntersecting; updateFab(); }).observe($('#add'));
  }

  /* ---------- Deslizar: derecha fija, izquierda elimina (solo tachadas) ---------- */
  const listEl = $('#list');

  function beginSwipe(s) {
    const item = s.item;
    item._tok = null;
    let u = item._under;
    if (!u) {
      u = document.createElement('div');
      u.setAttribute('aria-hidden', 'true');
      item.insertBefore(u, item.firstChild);
      item._under = u;
    }
    u.className = 'under ' + (s.done ? 'can-del' : 'no-del');
    u.innerHTML =
      '<span class="u-pin">' + ic('pin', 'fill') + '<span>' + (s.pinned ? 'Desfijar' : 'Fijar arriba') + '</span></span>' +
      '<span class="u-del">' + (s.done ? '<span>Eliminar</span>' + ic('trash') : '<span>Primero<br>táchala</span>') + '</span>';
    item.classList.add('swiping');
    s.face.style.transition = 'none';
  }
  function settle(s) {
    const { item, face } = s;
    const tok = {};
    item._tok = tok;
    face.style.transition = 'transform .34s cubic-bezier(.2, .9, .3, 1.12)';
    face.style.transform = '';
    setTimeout(() => {
      if (item._tok !== tok) return;
      face.style.transition = '';
      item.classList.remove('swiping');
      if (item._under) item._under.className = 'under';
    }, 360);
  }
  function slideAway(s) {
    const { item, face } = s;
    item._tok = null;
    if (item._under) item._under.classList.add('armed');
    face.style.transition = 'transform .2s cubic-bezier(.5, 0, .9, .6)';
    face.style.transform = 'translate3d(' + (-(s.width + 40)) + 'px, 0, 0)';
    setTimeout(() => removeTask(s.id), reduced() ? 0 : 180);
  }
  function hintStrikeFirst(s) {
    toast('Solo se eliminan las tareas tachadas. Táchala primero.');
    const box = s.face.querySelector('.box');
    if (box && box.animate && !reduced()) {
      box.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(.9)' }, { transform: 'scale(1)' }],
        { duration: 560, delay: 180, easing: 'ease-out' });
    }
  }

  const canSwipe = item => !!item && !!item._face && S.canWrite && S.mode !== 'loading' &&
    !item.classList.contains('editing') && !item.classList.contains('leaving');
  function flushDeferred() { if (renderDeferred) { renderDeferred = false; renderAll(); } }

  function swipeStart(item, x, y, t, src, tid) {
    swipe = { item, face: item._face, id: item.dataset.id, src, tid, x0: x, y0: y, lock: null,
      dx: 0, off: 0, samples: [{ x, t: performance.now() }], width: 0, threshold: 0, done: false, pinned: false };
  }
  // Velocidad al soltar (px/ms), con las posiciones de los últimos ~150 ms.
  function releaseVelocity(s) {
    const now = performance.now(), pts = s.samples, last = pts[pts.length - 1];
    if (!last || now - last.t > 90 || pts.length < 2) return 0;   // se detuvo antes de soltar
    const first = pts.find(p => last.t - p.t <= 150 && p !== last) || pts[pts.length - 2];
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : 0;
  }
  // Devuelve true cuando el gesto ya es horizontal: entonces hay que impedir el scroll.
  function swipeMove(x, y, t) {
    const s = swipe;
    if (!s) return false;
    const dx = x - s.x0, dy = y - s.y0;
    if (!s.lock) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 7 && ay < 7) return false;
      // Más vertical que horizontal: es scroll y se deja pasar.
      if (ax <= ay) { swipe = null; flushDeferred(); return false; }
      const task = tasksView().get(s.id);
      if (!task || !s.item.isConnected) { swipe = null; flushDeferred(); return false; }
      s.lock = 'x';
      s.done = isDone(task, ymd(new Date()));
      s.pinned = !!task.pinned;
      s.width = s.item.offsetWidth;
      s.threshold = Math.min(84, s.width * 0.25);
      beginSwipe(s);
    }
    const now = performance.now();
    s.samples.push({ x, t: now });
    while (s.samples.length > 2 && now - s.samples[0].t > 200) s.samples.shift();
    s.dx = dx;
    const T = s.threshold;
    let off;
    if (dx >= 0) off = dx <= T * 1.4 ? dx : T * 1.4 + (dx - T * 1.4) * 0.4;  // fijar: frena pasado el umbral
    else if (s.done) off = Math.max(dx, -s.width);                            // tachada: se arrastra hasta sacarla
    else off = -96 * (1 - Math.exp(dx / 150));                                // sin tachar: resiste y no llega
    s.off = off;
    s.face.style.transform = 'translate3d(' + off.toFixed(1) + 'px, 0, 0)';
    const u = s.item._under;
    u.classList.toggle('dir-right', off > 0);
    u.classList.toggle('dir-left', off < 0);
    u.classList.toggle('armed', off > 0 ? off >= T : (s.done && -off >= T));
    return true;
  }
  function swipeEnd(cancelled, t) {
    const s = swipe;
    swipe = null;
    if (!s) return;
    if (s.lock !== 'x') { flushDeferred(); return; }
    suppressClickUntil = performance.now() + 450;
    // Un gesto rápido cuenta aunque no llegue a la distancia.
    const v = cancelled ? 0 : releaseVelocity(s);
    const flick = Math.abs(v) > 0.35 && Math.abs(s.dx) > 28;
    if (!cancelled && s.off > 0 && (s.off >= s.threshold || (flick && v > 0))) {
      settle(s); renderDeferred = false; togglePin(s.id); return;
    }
    if (!cancelled && s.off < 0 && s.done && (-s.off >= s.threshold || (flick && v < 0))) {
      renderDeferred = false; slideAway(s); return;
    }
    settle(s);
    if (!cancelled && s.off < 0 && !s.done && (-s.dx >= s.threshold || (flick && v < 0))) hintStrikeFirst(s);
    flushDeferred();
  }

  /* ---------- Mantener presionada para mover ---------- */
  const PRESS_MS = 380;
  function armPress(item, x, y, src, tid) {
    cancelPress();
    const p = { item, x0: x, y0: y, y, src, tid, timer: 0, hint: 0 };
    p.hint = setTimeout(() => { if (press === p) item.classList.add('pressing'); }, 140);
    p.timer = setTimeout(() => {
      if (press !== p) return;
      press = null;
      item.classList.remove('pressing');
      startDrag(p);
    }, PRESS_MS);
    press = p;
  }
  function cancelPress() {
    const p = press; if (!p) return;
    press = null;
    clearTimeout(p.timer); clearTimeout(p.hint);
    p.item.classList.remove('pressing');
  }
  // Si el dedo se mueve antes de tiempo no es "mantener presionado": es scroll o deslizar.
  function pressMoved(x, y) {
    const p = press; if (!p) return;
    if (Math.abs(x - p.x0) > 6 || Math.abs(y - p.y0) > 6) cancelPress(); else p.y = y;
  }
  function startDrag(p) {
    const item = p.item;
    if (drag || dropping || !canSwipe(item) || !item.isConnected) return;
    if (S.editing !== null && S.editing !== 'new') return;
    const t = tasksView().get(item.dataset.id); if (!t) return;
    const ids = groupIds(t);
    const els = ids.map(id => cardEls.get(id)).filter(Boolean);
    const o = els.indexOf(item);
    if (o < 0) return;
    swipe = null;
    drag = { item, id: item.dataset.id, src: p.src, tid: p.tid, o, target: o,
      metrics: els.map(el => ({ el, top: el.offsetTop, h: el.offsetHeight })),
      startY: p.y, lastY: p.y, startScroll: window.scrollY, raf: 0 };
    suppressClickUntil = Infinity;
    listEl.classList.add('reordering');
    item.classList.add('dragging');
    if (p.src === 'mouse') { try { item.setPointerCapture(p.tid); } catch (err) { /* sin captura */ } }
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) { /* sin vibración */ }
    drag.raf = requestAnimationFrame(autoScroll);
  }
  function layoutOthers(d, target) {
    const m = d.metrics, shift = m[d.o].h + 12;
    m.forEach((x, k) => {
      if (k === d.o) return;
      const s = (k < d.o && target <= k) ? shift : (k > d.o && target >= k) ? -shift : 0;
      x.el.style.transform = s ? 'translate3d(0, ' + s + 'px, 0)' : '';
    });
  }
  function dragMove(y) {
    const d = drag; if (!d) return;
    d.lastY = y;
    const dy = y - d.startY + (window.scrollY - d.startScroll);
    d.item.style.transform = 'translate3d(0, ' + dy.toFixed(1) + 'px, 0)';
    const m = d.metrics, me = m[d.o];
    const center = me.top + me.h / 2 + dy;
    let t = 0;
    for (let i = 0; i < m.length; i++) if (i !== d.o && center > m[i].top + m[i].h / 2) t++;
    if (t !== d.target) { d.target = t; layoutOthers(d, t); }
  }
  // Cerca del borde de la pantalla, la página se desplaza sola para poder llevar la tarea más lejos.
  function autoScroll() {
    const d = drag; if (!d) return;
    const vh = window.innerHeight, edge = Math.min(90, vh * 0.15);
    let v = 0;
    if (d.lastY < edge) v = -Math.ceil(((edge - d.lastY) / edge) * 14);
    else if (d.lastY > vh - edge) v = Math.ceil(((d.lastY - (vh - edge)) / edge) * 14);
    if (v) {
      const before = window.scrollY;
      window.scrollBy(0, v);
      if (window.scrollY !== before) dragMove(d.lastY);
    }
    d.raf = requestAnimationFrame(autoScroll);
  }
  function dragEnd(cancel) {
    const d = drag; if (!d) return;
    drag = null;
    dropping = true;
    cancelAnimationFrame(d.raf);
    if (d.src === 'mouse') { try { d.item.releasePointerCapture(d.tid); } catch (err) { /* ya liberado */ } }
    const m = d.metrics, o = d.o, t = cancel ? o : d.target;
    if (cancel) layoutOthers(d, o);
    const newTop = t === o ? m[o].top : t < o ? m[t].top : m[t].top + m[t].h - m[o].h;
    d.item.classList.remove('dragging');
    d.item.classList.add('dropping');
    d.item.style.transform = 'translate3d(0, ' + (newTop - m[o].top) + 'px, 0)';
    setTimeout(() => {
      listEl.classList.remove('reordering');
      d.item.classList.remove('dropping');
      m.forEach(x => { x.el.style.transition = 'none'; x.el.style.transform = ''; });
      suppressClickUntil = performance.now() + 450;
      dropping = false;
      if (t !== o) {
        const ids = m.map(x => x.el.dataset.id);
        ids.splice(o, 1);
        ids.splice(t, 0, d.id);
        commitReorder(d.id, ids);
      }
      renderDeferred = false;
      renderAll({ instant: true });
      requestAnimationFrame(() => m.forEach(x => { x.el.style.transition = ''; }));
    }, reduced() ? 0 : 190);
  }

  // Dedo: eventos táctiles, para frenar el scroll apenas el gesto es horizontal o la tarea se está moviendo.
  listEl.addEventListener('touchstart', e => {
    if (drag) return;
    if (swipe && swipe.src === 'touch') swipeEnd(true);
    cancelPress();
    if (e.touches.length !== 1) return;
    const item = e.target.closest ? e.target.closest('.item') : null;
    if (!canSwipe(item)) return;
    const p = e.touches[0];
    swipeStart(item, p.clientX, p.clientY, e.timeStamp, 'touch', p.identifier);
    armPress(item, p.clientX, p.clientY, 'touch', p.identifier);
  }, { passive: true });
  listEl.addEventListener('touchmove', e => {
    if (drag && drag.src === 'touch') {
      if (e.cancelable) e.preventDefault();
      const f = Array.from(e.touches).find(q => q.identifier === drag.tid);
      if (f) dragMove(f.clientY);
      return;
    }
    const p = e.touches[0];
    if (press && press.src === 'touch' && p) pressMoved(p.clientX, p.clientY);
    const s = swipe;
    if (!s || s.src !== 'touch') return;
    if (e.touches.length !== 1) { swipeEnd(true); return; }
    if (p.identifier !== s.tid) return;
    if (swipeMove(p.clientX, p.clientY, e.timeStamp) && e.cancelable) e.preventDefault();
  }, { passive: false });
  listEl.addEventListener('touchend', e => {
    if (drag && drag.src === 'touch') { dragEnd(false); return; }
    cancelPress();
    if (swipe && swipe.src === 'touch') swipeEnd(false, e.timeStamp);
  });
  listEl.addEventListener('touchcancel', e => {
    if (drag && drag.src === 'touch') { dragEnd(true); return; }
    cancelPress();
    if (swipe && swipe.src === 'touch') swipeEnd(true, e.timeStamp);
  });

  // Mouse (computadora): eventos de puntero.
  listEl.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || drag) return;
    if (swipe && swipe.src === 'mouse') swipeEnd(true);
    cancelPress();
    const item = e.target.closest('.item');
    if (!canSwipe(item)) return;
    swipeStart(item, e.clientX, e.clientY, e.timeStamp, 'mouse', e.pointerId);
    armPress(item, e.clientX, e.clientY, 'mouse', e.pointerId);
  });
  listEl.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (drag && drag.src === 'mouse') { e.preventDefault(); dragMove(e.clientY); return; }
    if (press && press.src === 'mouse') pressMoved(e.clientX, e.clientY);
    const s = swipe;
    if (!s || s.src !== 'mouse' || e.pointerId !== s.tid) return;
    const wasLocked = !!s.lock;
    if (swipeMove(e.clientX, e.clientY, e.timeStamp)) {
      if (!wasLocked) { try { s.item.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ } }
      e.preventDefault();
    }
  });
  const mouseEnd = e => {
    if (e.pointerType !== 'mouse') return;
    if (drag && drag.src === 'mouse') { dragEnd(e.type === 'pointercancel'); return; }
    cancelPress();
    const s = swipe;
    if (!s || s.src !== 'mouse' || e.pointerId !== s.tid) return;
    try { s.item.releasePointerCapture(e.pointerId); } catch (err) { /* ya liberado */ }
    swipeEnd(e.type === 'pointercancel', e.timeStamp);
  };
  listEl.addEventListener('pointerup', mouseEnd);
  listEl.addEventListener('pointercancel', mouseEnd);
  // Si el botón se suelta fuera de la lista, también se cierra todo.
  document.addEventListener('pointerup', e => {
    if (e.pointerType !== 'mouse') return;
    if (drag && drag.src === 'mouse') dragEnd(false);
    if (press && press.src === 'mouse') cancelPress();
  });
  // Sin menú contextual al mantener presionada una tarjeta.
  listEl.addEventListener('contextmenu', e => {
    const item = e.target.closest('.item');
    if (item && !item.classList.contains('editing')) e.preventDefault();
  });

  /* ---------- Eventos ---------- */
  listEl.addEventListener('click', e => {
    if (performance.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
    const item = e.target.closest('.item');
    if (!item || item.classList.contains('editing') || item.classList.contains('leaving')) return;
    const id = item.dataset.id;
    if (!id) return;
    if (e.target.closest('.check')) { toggle(id); return; }
    if (e.target.closest('.t-main[role="button"]')) openEditor(id);
  });
  listEl.addEventListener('keydown', e => {
    const m = e.target.closest && e.target.closest('.t-main[role="button"]');
    if (!m || m !== e.target) return;
    const item = m.closest('.item');
    if (!item || !item.dataset.id) return;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveBy(item.dataset.id, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openEditor(item.dataset.id);
  });
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    if (S.filter === b.dataset.filter) return;
    S.filter = b.dataset.filter;
    lsSet(LS_FILTER, S.filter);
    S.linger.clear();
    renderAll({ instant: true });
  }));
  $('#add').addEventListener('click', openComposer);
  $('#fab').addEventListener('click', openComposer);
  $('#limpiar').addEventListener('click', clearDone);
  $('#borrar-ej').addEventListener('click', clearExamples);

  setInterval(() => {
    const n = new Date();
    if (ymd(n) + '|' + (n.getHours() * 60 + n.getMinutes()) !== S.minuteKey) renderAll();
    checkAlerts();
  }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (drag) dragEnd(true); cancelPress(); }
    else { renderAll(); checkAlerts(); pushSync(true); }
  });

  let lastW = 0;
  if ('ResizeObserver' in window) {
    new ResizeObserver(es => {
      const w = Math.round(es[0].contentRect.width);
      if (w !== lastW) { lastW = w; requestAnimationFrame(redrawStrikes); }
    }).observe($('#list'));
  }
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(redrawStrikes));
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => requestAnimationFrame(redrawStrikes));
  }

  /* ---------- Alertas ---------- */
  // A la hora de cada tarea: mensaje en la app, sonido, vibración y, con permiso, notificación del teléfono.
  // Funcionan mientras la app está abierta; para avisos con la app cerrada está la alarma del calendario.
  const PUSH = { on: false, sub: null, sig: '', timer: 0, ready: Promise.resolve() };   // avisos del servidor (ver más abajo)
  const LS_ALERTED = 'hazlo.avisados';
  const LS_SNOOZE = 'hazlo.posponer';
  const readJSON = k => { try { const v = JSON.parse(lsGet(k)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  const alerted = readJSON(LS_ALERTED);    // clave de aviso -> cuándo se dio
  const snoozes = readJSON(LS_SNOOZE);     // id de tarea -> cuándo volver a avisar
  const saveAlerted = () => { lsSet(LS_ALERTED, JSON.stringify(alerted)); pushSoon(); };
  const saveSnoozes = () => { lsSet(LS_SNOOZE, JSON.stringify(snoozes)); pushSoon(); };
  (function prune() {
    const limit = Date.now() - 3 * 864e5;
    let changed = false;
    for (const k of Object.keys(alerted)) if (alerted[k] < limit && k.indexOf('|sin-fecha|') < 0) { delete alerted[k]; changed = true; }
    if (changed) saveAlerted();
  })();

  // Minuto del día en que la tarea debe avisar hoy, o null si hoy no le toca.
  function alertMinute(t, today) {
    if (!t.time || isDone(t, today)) return null;
    if (t.repeat === 'diaria' || t.date === today || !t.date) return toMin(t.time);
    return null;
  }
  const alertKey = (t, today) => t.id + '|' + (t.repeat === 'diaria' || t.date ? today : 'sin-fecha') + '|' + t.time;
  // Si se guarda una tarea con una hora que ya pasó hoy, no se avisa "tarde".
  function markPastAlert(t) {
    const now = new Date(), today = ymd(now), m = alertMinute(t, today);
    if (m !== null && now.getHours() * 60 + now.getMinutes() > m) { alerted[alertKey(t, today)] = Date.now(); saveAlerted(); }
  }

  function checkAlerts() {
    if (S.mode === 'loading') return;
    const view = tasksView();
    const now = new Date(), today = ymd(now), nowMin = now.getHours() * 60 + now.getMinutes(), nowTs = now.getTime();
    const due = [], missed = [];
    let changed = false, snoozeChanged = false;
    for (const id of Object.keys(snoozes)) if (!view.has(id)) { delete snoozes[id]; snoozeChanged = true; }
    for (const t of view.values()) {
      if (snoozes[t.id] && nowTs >= snoozes[t.id]) {
        delete snoozes[t.id]; snoozeChanged = true;
        if (!isDone(t, today)) due.push(t);
        continue;
      }
      const m = alertMinute(t, today);
      if (m === null || nowMin < m) continue;
      const key = alertKey(t, today);
      if (alerted[key]) continue;
      alerted[key] = nowTs; changed = true;
      const at = new Date(now); at.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (t.createdAt > at.getTime()) continue;        // se creó después de su hora: no avisar
      if (nowMin - m <= 2) due.push(t); else missed.push(t);
    }
    if (changed) saveAlerted();
    if (snoozeChanged) saveSnoozes();
    if (due.length) {
      due.forEach(systemNotify);
      showAviso(due, false);
      chime();
      const touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      try { if (navigator.vibrate && touched) navigator.vibrate([140, 80, 140]); } catch (e) { /* sin vibración */ }
    } else if (missed.length) {
      showAviso(missed, true);
    }
    if (due.length || missed.length) renderAlertsPanel();
  }

  let avisoTimer = 0;
  const label = t => (t.emoji ? t.emoji + ' ' : '') + t.title;
  function showAviso(list, missed) {
    const one = list.length === 1 ? list[0] : null;
    $('#av-titulo').textContent = missed
      ? (one ? 'Se te pasó la hora' : 'Se te pasó la hora de ' + list.length + ' tareas')
      : (one ? 'Es hora' : 'Es hora de ' + list.length + ' tareas');
    $('#av-texto').textContent = one ? label(one) + ' · ' + fmtTime(one.time) : list.map(label).join(' · ');
    const acts = $('#av-acciones');
    acts.textContent = '';
    const add = (text, main, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'av-btn' + (main ? ' av-main' : ''); b.textContent = text;
      b.addEventListener('click', () => { hideAviso(); if (fn) fn(); });
      acts.appendChild(b);
    };
    if (one && S.canWrite) {
      add('Tachar', true, () => { const cur = tasksView().get(one.id); if (cur && !isDone(cur, ymd(new Date()))) toggle(one.id); });
      if (!missed) add('En 10 min', false, () => { snoozes[one.id] = Date.now() + 10 * 60e3; saveSnoozes(); toast('Te vuelvo a avisar en 10 minutos.'); });
    } else if (!one) {
      add('Ver pendientes', true, () => {
        S.filter = 'pendientes'; lsSet(LS_FILTER, S.filter); renderAll({ instant: true });
        window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      });
    }
    add('Cerrar', false, null);
    const el = $('#aviso');
    el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(hideAviso, missed ? 12000 : 45000);
  }
  function hideAviso() { clearTimeout(avisoTimer); $('#aviso').hidden = true; }

  // Sonido corto: el navegador solo deja sonar después de que tocaste la app al menos una vez.
  let audioCtx = null;
  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* sin sonido */ }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive: true }));
  function chime() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const t0 = audioCtx.currentTime;
    [[784, 0], [1175, 0.17], [1568, 0.34]].forEach(([f, d]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.38);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.42);
    });
  }

  async function systemNotify(t) {
    await PUSH.ready;
    if (PUSH.on) return;            // con avisos del servidor, la notificación la manda el servidor
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const title = '⏰ ' + label(t);
    const opts = { body: 'Es hora · ' + fmtTime(t.time), tag: 'hazlo-' + t.id, renotify: true,
      icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', data: { id: t.id } };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) { await reg.showNotification(title, opts); return; }
    } catch (e) { /* se intenta abajo */ }
    try { new Notification(title, opts); } catch (e) { /* sin notificación */ }
  }

  const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const panelOpen = () => !$('#alertas').hidden;
  function togglePanel(open) {
    const p = $('#alertas'), b = $('#bell');
    const show = open === undefined ? p.hidden : open;
    if (show) closePerso();
    p.hidden = !show;
    b.setAttribute('aria-expanded', String(show));
    if (show) { renderAlertsPanel(); p.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }
  }
  function renderAlertsPanel() {
    const now = new Date(), today = ymd(now), tomorrow = shift(today, 1), nowMin = now.getHours() * 60 + now.getMinutes();
    const items = [];
    for (const t of tasksView().values()) {
      if (!t.time) continue;
      const m = toMin(t.time), doneToday = isDone(t, today);
      if (t.repeat === 'diaria') {
        if (!doneToday && m >= nowMin && !alerted[alertKey(t, today)]) items.push({ t, m, day: 0 });
        else items.push({ t, m, day: 1 });
      } else if ((t.date === today || !t.date) && !t.done && m >= nowMin && !alerted[alertKey(t, today)]) items.push({ t, m, day: 0 });
      else if (t.date === tomorrow && !t.done) items.push({ t, m, day: 1 });
    }
    // Las pospuestas ("en 10 min") también se muestran.
    for (const id of Object.keys(snoozes)) {
      const t = tasksView().get(id), at = new Date(snoozes[id]);
      if (t && !isDone(t, today)) items.push({ t, m: at.getHours() * 60 + at.getMinutes(), day: 0, at: pad(at.getHours()) + ':' + pad(at.getMinutes()) });
    }
    items.sort((a, b) => (a.day - b.day) || (a.m - b.m));
    $('#bell').classList.toggle('has-next', items.some(i => i.day === 0));
    pushSoon();
    if (!panelOpen()) return;

    const st = $('#al-estado'), pb = $('#al-permitir');
    pb.hidden = true;
    if (!('Notification' in window)) {
      st.textContent = isStandalone()
        ? 'Este teléfono no permite notificaciones para la app; te aviso dentro de ella.'
        : 'Las notificaciones del teléfono se activan al instalar la app en tu pantalla de inicio.';
    } else if (Notification.permission === 'granted') st.textContent = PUSH.on
      ? 'Notificaciones del teléfono: activadas, también con la app cerrada. ✅'
      : 'Notificaciones del teléfono: activadas mientras la app está abierta.';
    else if (Notification.permission === 'denied') st.textContent = 'Las notificaciones están bloqueadas. Puedes activarlas en los ajustes del teléfono.';
    else { st.textContent = 'Notificaciones del teléfono: falta tu permiso.'; pb.hidden = false; }

    $('#al-tip').hidden = PUSH.on;
    $('#al-texto').textContent = PUSH.on
      ? 'A la hora de cada tarea te llega una notificación, aunque la app esté cerrada o el celular bloqueado.'
      : 'A la hora de cada tarea te aviso con un mensaje, un sonido y vibración mientras la app esté abierta.';
    const ul = $('#al-lista');
    ul.textContent = '';
    if (!items.length) {
      const li = document.createElement('li'); li.className = 'al-empty';
      li.textContent = 'Todavía no hay tareas con hora. Ponle hora a una tarea y te aviso.';
      ul.appendChild(li);
      return;
    }
    for (const { t, day, at } of items.slice(0, 6)) {
      const li = document.createElement('li');
      const tm = document.createElement('span'); tm.className = 'al-time'; tm.textContent = fmtTime(at || t.time);
      if (day || at) { const sm = document.createElement('small'); sm.textContent = at ? 'pospuesta' : 'mañana'; tm.appendChild(sm); }
      const nm = document.createElement('span'); nm.className = 'al-name'; nm.textContent = label(t);
      li.append(tm, nm); ul.appendChild(li);
    }
  }

  /* ---------- Avisos con la app cerrada (servidor) ---------- */
  // El servidor guarda la hora de tus tareas y te manda la notificación a la hora exacta.
  // Solo recibe lo necesario para avisar: nombre, emoji y hora de las tareas que tienen hora.
  function b64ToBytes(s) {
    const b = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(b, c => c.charCodeAt(0));
  }
  function pushSetup() { PUSH.ready = pushSetupRun(); return PUSH.ready; }
  async function pushSetupRun() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const r = await fetch('/api/avisos/clave', { cache: 'no-store' });
        if (!r.ok) return;                     // sin servidor (por ejemplo, subida a mano): solo avisos con la app abierta
        const { publicKey } = await r.json();
        if (!publicKey) return;
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      }
      PUSH.sub = sub; PUSH.on = true;
      pushSync(true);
      renderAlertsPanel();
    } catch (e) { PUSH.on = false; }
  }
  function pushPayload() {
    const tasks = [];
    for (const t of tasksView().values()) if (t.time) tasks.push({ id: t.id, title: t.title.slice(0, 120), emoji: t.emoji, time: t.time,
      date: t.date, repeat: t.repeat, done: t.done, doneOn: t.doneOn, createdAt: t.createdAt });
    let tz = 'America/Lima';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* zona por defecto */ }
    return { tz, tasks, snoozes, avisados: Object.keys(alerted) };
  }
  async function pushSync(force) {
    if (!PUSH.on || !PUSH.sub || S.mode === 'loading') return;
    const data = pushPayload();
    const sig = JSON.stringify(data);
    if (!force && sig === PUSH.sig) return;
    PUSH.sig = sig;
    try {
      const r = await fetch('/api/avisos', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ sub: PUSH.sub.toJSON() }, data)), keepalive: sig.length < 60000 });
      if (!r.ok) PUSH.sig = '';
    } catch (e) { PUSH.sig = ''; }          // sin internet: se reintenta en el próximo cambio
  }
  function pushSoon() {
    if (!PUSH.on) return;
    clearTimeout(PUSH.timer);
    PUSH.timer = setTimeout(() => pushSync(false), 1200);
  }

  async function askPermission() {
    if (!('Notification' in window)) return;
    try { await Notification.requestPermission(); } catch (e) { /* el usuario decide */ }
    if (Notification.permission === 'granted') await pushSetup();
    renderAlertsPanel();
    if (Notification.permission === 'granted') toast(PUSH.on
      ? 'Listo: te aviso a la hora de cada tarea, aunque la app esté cerrada.'
      : 'Listo: también te aviso con notificaciones del teléfono.');
  }
  $('#bell').addEventListener('click', () => togglePanel());
  $('#alertas-cerrar').addEventListener('click', () => togglePanel(false));
  $('#al-permitir').addEventListener('click', askPermission);

  // Alarma en el calendario del teléfono: suena aunque la app esté cerrada (diaria si la tarea es diaria).
  const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const enc = new TextEncoder();
  function fold(line) {               // líneas de máximo 75 bytes, como pide el formato de calendario
    const parts = []; let cur = '', bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      if (bytes + n > 73) { parts.push(cur); cur = ' ' + ch; bytes = 1 + n; } else { cur += ch; bytes += n; }
    }
    parts.push(cur);
    return parts.join('\r\n');
  }
  function addToCalendar(t) {
    if (!t.time) return;
    const now = new Date(), today = ymd(now), nowMin = now.getHours() * 60 + now.getMinutes();
    let date = t.repeat === 'diaria' ? today : (t.date || today);
    if ((t.repeat === 'diaria' || !t.date) && toMin(t.time) <= nowMin) date = shift(today, 1);   // ya pasó hoy: desde mañana
    else if (date < today || (date === today && toMin(t.time) <= nowMin)) { toast('Esa hora ya pasó: elige una hora futura para la alarma.'); return; }
    const title = label(t);
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hazlo//Tareas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + (t.id || 'tarea') + '-' + now.getTime() + '@hazlo', 'DTSTAMP:' + stamp,
      'DTSTART:' + date.replace(/-/g, '') + 'T' + t.time.replace(':', '') + '00', 'DURATION:PT15M',
      'SUMMARY:' + icsText(title)];
    if (t.repeat === 'diaria') lines.push('RRULE:FREQ=DAILY');
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(title), 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    const ics = lines.map(fold).join('\r\n') + '\r\n';
    const slug = (t.title || 'tarea').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tarea';
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) {
      // En iPhone, el Calendario abre este tipo de enlace y ofrece agregar el evento con su alarma.
      window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      toast('Abriendo el Calendario para agregar la alarma…');
    } else {
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'hazlo-' + slug + '.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast('Alarma descargada: ábrela para agregarla a tu calendario.');
    }
  }

  /* ---------- Tu nombre ---------- */
  const LS_NAME = 'hazlo.nombre';
  const LS_NAME_ASKED = 'hazlo.nombre.preguntado';
  const holaBtn = document.getElementById('hola');
  const nameBox = document.getElementById('nombre');
  const nameInput = document.getElementById('nombre-input');
  function showName() {
    const n = (lsGet(LS_NAME) || '').trim();
    holaBtn.textContent = n ? '¡Hola, ' + n.split(' ')[0] + '! 👋' : 'Tareas diarias';
    holaBtn.classList.toggle('named', !!n);
    holaBtn.setAttribute('aria-label', n ? 'Hola, ' + n + '. Personalizar la app' : 'Personalizar la app');
  }
  function openName(focus) {
    nameInput.value = lsGet(LS_NAME) || '';
    nameBox.querySelector('h2').textContent = lsGet(LS_NAME) ? 'Tu nombre ✏️' : '¡Bienvenido! 👋';
    nameBox.hidden = false;
    if (focus) setTimeout(() => nameInput.focus(), 50);
  }
  function closeName() { nameBox.hidden = true; lsSet(LS_NAME_ASKED, '1'); }
  document.getElementById('nombre-form').addEventListener('submit', e => {
    e.preventDefault();
    const n = nameInput.value.replace(/\s+/g, ' ').trim().slice(0, 24);
    lsSet(LS_NAME, n);
    nameInput.blur();
    closeName();
    showName();
    if (n) toast('¡Listo, ' + n + '! Toca tu saludo para personalizar la app 🎨');
  });
  document.getElementById('nombre-saltar').addEventListener('click', closeName);
  showName();
  if (!lsGet(LS_NAME) && !lsGet(LS_NAME_ASKED)) openName(false);

  /* ---------- Personalizar: colores, bordes y letra ---------- */
  // Cada persona ajusta su propia app y se guarda solo en su teléfono. El <head> del index.html aplica
  // lo guardado antes de pintar, así al abrir no se ven un instante los colores originales.
  const LS_THEME = 'hazlo.tema';
  const LS_THEME_CSS = 'hazlo.tema.css';
  const THEME_DEF = { header: '#3FD6B0', buttons: '#4A86E8', page: '#FFFFFF', radius: 20, font: 'redondeada' };
  const THEME_KEYS = ['--band-1', '--band-2', '--brand', '--page-accent', '--cta-1', '--cta-2', '--on-cta', '--cta-edge',
    '--page', '--surface-2', '--r', '--font-display', '--font-body'];
  const FONT_SETS = {
    redondeada: null,   // la de siempre: Fredoka en títulos y Nunito en el texto
    suave: '"Nunito", ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    clasica: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    maquina: '"American Typewriter", "Courier New", Courier, monospace',
  };
  const PRESETS = [['Menta', '#3FD6B0'], ['Lila', '#8A5CF6'], ['Naranja', '#FF8A3D'], ['Rosa', '#E8507A'],
    ['Azul', '#4A86E8'], ['Verde', '#2C9445'], ['Carbón', '#1D2C30'], ['Blanco', '#FFFFFF']];
  const NOTES = {
    header: 'El encabezado usa un tono suave de este color, para que el texto se lea bien.',
    buttons: 'Los botones usan este color tal cual. Si es muy claro, su texto se pone oscuro.',
    page: 'El fondo usa un tono muy suave de este color, para que todo se lea bien.',
  };

  // Colores
  const HEX_RE = /^#[0-9a-f]{6}$/i;
  const WHITE = [255, 255, 255], INK = [29, 44, 48], MUTED = [90, 110, 114];
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgbToHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function rgbToHsl(c) {
    const [r, g, b] = c.map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (!d) return [0, 0, l];
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, d / (1 - Math.abs(2 * l - 1)), l];
  }
  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  // Encabezado: un degradado suave del color y letras del mismo tono, bien oscuras.
  function headerVars(hex) {
    const c = hexToRgb(hex), [h, s] = rgbToHsl(c), sat = s < 0.08 ? 0 : Math.min(0.6, Math.max(0.35, s));
    let t = 0.61, b2 = mixRgb(c, WHITE, t), l = 0.3, ink = hslToRgb(h, sat, l);
    while (contrast(ink, b2) < 4.7 && l > 0.1) { l -= 0.02; ink = hslToRgb(h, sat, l); }
    while (contrast(ink, b2) < 4.7 && t < 0.9) { t += 0.03; b2 = mixRgb(c, WHITE, t); }
    const b1 = mixRgb(c, WHITE, Math.min(0.95, Math.max(0.84, t + 0.2)));
    return { '--band-1': rgbToHex(b1), '--band-2': rgbToHex(b2), '--brand': rgbToHex(ink), '--page-accent': rgbToHex(ink) };
  }
  // Botones: el color tal cual, con un tono más oscuro abajo; letra blanca u oscura según se lea mejor.
  function buttonVars(hex) {
    const c = hexToRgb(hex), [h, s, l] = rgbToHsl(c);
    const c2 = hslToRgb(h, s * 0.85, Math.max(0, l - 0.09));
    const mid = mixRgb(c, c2, 0.5);
    return { '--cta-1': rgbToHex(c), '--cta-2': rgbToHex(c2), '--on-cta': contrast(WHITE, mid) >= 3 ? '#FFFFFF' : '#1D2C30' };
  }
  // Fondo: un tono muy suave, siempre lo bastante claro para leer el texto gris.
  function pageVars(hex) {
    const c = hexToRgb(hex);
    let t = 0.88, p = mixRgb(c, WHITE, t);
    while (contrast(MUTED, p) < 4.5 && t < 0.97) { t += 0.01; p = mixRgb(c, WHITE, t); }
    return { '--page': rgbToHex(p), '--surface-2': rgbToHex(mixRgb(p, INK, 0.07)) };
  }
  function themeVars(th) {
    const v = {};
    if (th.header) Object.assign(v, headerVars(th.header));
    if (th.buttons) Object.assign(v, buttonVars(th.buttons));
    if (th.page) Object.assign(v, pageVars(th.page));
    if (Number.isFinite(th.radius) && th.radius !== THEME_DEF.radius) v['--r'] = th.radius + 'px';
    const f = FONT_SETS[th.font];
    if (f) { v['--font-display'] = f; v['--font-body'] = f; }
    // Si los botones casi se confunden con el fondo, llevan un borde fino.
    const mid = mixRgb(hexToRgb(v['--cta-1'] || '#4A86E8'), hexToRgb(v['--cta-2'] || '#2F66D6'), 0.5);
    if (contrast(mid, hexToRgb(v['--page'] || '#FFFFFF')) < 1.4) v['--cta-edge'] = 'rgba(29, 44, 48, .22)';
    return v;
  }
  function readTheme() {
    let t = null;
    try { t = JSON.parse(lsGet(LS_THEME)); } catch (e) { t = null; }
    const out = {};
    if (!t || typeof t !== 'object') return out;
    for (const k of ['header', 'buttons', 'page']) if (HEX_RE.test(t[k]) && t[k].toUpperCase() !== THEME_DEF[k]) out[k] = t[k].toUpperCase();
    if (Number.isFinite(t.radius) && t.radius !== THEME_DEF.radius) out.radius = Math.max(0, Math.min(28, Math.round(t.radius)));
    if (FONT_SETS[t.font]) out.font = t.font;
    return out;
  }

  let theme = readTheme();
  let themeCss = {};
  let fontShown = theme.font || 'redondeada';
  let themeSaveTimer = 0;
  function saveTheme() {
    clearTimeout(themeSaveTimer); themeSaveTimer = 0;
    lsSet(LS_THEME, JSON.stringify(theme));
    lsSet(LS_THEME_CSS, JSON.stringify(themeCss));
  }
  function applyTheme(save) {
    themeCss = themeVars(theme);
    const st = document.documentElement.style;
    for (const k of THEME_KEYS) { if (themeCss[k] === undefined) st.removeProperty(k); else st.setProperty(k, themeCss[k]); }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeCss['--band-1'] || '#D9FCF3');
    const f = theme.font || 'redondeada';
    if (f !== fontShown) { fontShown = f; requestAnimationFrame(redrawStrikes); }   // la letra nueva mueve las líneas del tachado
    if (save) { clearTimeout(themeSaveTimer); themeSaveTimer = setTimeout(saveTheme, 250); }
  }
  let themeRaf = 0;
  const applySoon = () => { if (!themeRaf) themeRaf = requestAnimationFrame(() => { themeRaf = 0; applyTheme(true); }); };
  if (Object.keys(theme).length) applyTheme(true);   // recalcula con la versión actual y refresca lo guardado
  document.addEventListener('visibilitychange', () => { if (document.hidden && themeSaveTimer) saveTheme(); });

  // Panel
  const pz = $('#perso'), pzName = $('#pz-nombre'), pzHex = $('#pz-hex'), pzSw = $('#pz-swatch');
  const pzR = $('#pz-r'), pzG = $('#pz-g'), pzB = $('#pz-b'), pzRadius = $('#pz-radio'), pzPresets = $('#pz-presets');
  let pzTarget = 'header';
  const curColor = () => theme[pzTarget] || THEME_DEF[pzTarget];
  for (const [name, hex] of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pz-dot'; b.dataset.hex = hex; b.style.background = hex;
    b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', 'false');
    pzPresets.appendChild(b);
  }
  function syncMixer() {
    const hex = curColor(), c = hexToRgb(hex), [r, g, b] = c;
    pzR.value = r; pzG.value = g; pzB.value = b;
    $('#pz-rv').textContent = r; $('#pz-gv').textContent = g; $('#pz-bv').textContent = b;
    if (document.activeElement !== pzHex) pzHex.value = hex;
    pzSw.style.background = hex;
    pzSw.style.color = contrast(WHITE, c) >= 2.2 ? '#FFFFFF' : '#1D2C30';
    // Cada barra muestra hacia dónde cambia el color si la mueves.
    const track = (a, z) => 'linear-gradient(90deg, ' + rgbToHex(a) + ', ' + rgbToHex(z) + ')';
    pzR.style.setProperty('--track', track([0, g, b], [255, g, b]));
    pzG.style.setProperty('--track', track([r, 0, b], [r, 255, b]));
    pzB.style.setProperty('--track', track([r, g, 0], [r, g, 255]));
    for (const d of pzPresets.children) d.setAttribute('aria-pressed', String(d.dataset.hex === hex));
    for (const t of pz.querySelectorAll('[data-target]')) t.setAttribute('aria-checked', String(t.dataset.target === pzTarget));
    $('#pz-nota').textContent = NOTES[pzTarget];
  }
  function syncRadius() {
    const r = Number.isFinite(theme.radius) ? theme.radius : THEME_DEF.radius;
    pzRadius.value = r;
    $('#pz-radio-v').textContent = r + ' px';
    for (const b of pz.querySelectorAll('[data-r]')) b.setAttribute('aria-pressed', String(+b.dataset.r === r));
  }
  function syncFonts() {
    const f = theme.font || 'redondeada';
    for (const b of pz.querySelectorAll('[data-font]')) b.setAttribute('aria-checked', String(b.dataset.font === f));
  }
  const syncPerso = () => { syncMixer(); syncRadius(); syncFonts(); };
  function setColor(hex) {
    hex = hex.toUpperCase();
    if (hex === THEME_DEF[pzTarget]) delete theme[pzTarget]; else theme[pzTarget] = hex;
    applySoon(); syncMixer();
  }
  function setRadius(r) {
    if (r === THEME_DEF.radius) delete theme.radius; else theme.radius = r;
    applySoon(); syncRadius();
  }
  for (const el of [pzR, pzG, pzB]) el.addEventListener('input', () => setColor(rgbToHex([+pzR.value, +pzG.value, +pzB.value])));
  pzHex.addEventListener('input', () => {
    let v = pzHex.value.trim();
    if (v && v[0] !== '#') v = '#' + v;
    if (HEX_RE.test(v)) setColor(v);
  });
  pzHex.addEventListener('blur', () => { pzHex.value = curColor(); });
  pzHex.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pzHex.blur(); } });
  pzPresets.addEventListener('click', e => { const d = e.target.closest('.pz-dot'); if (d) setColor(d.dataset.hex); });
  for (const t of pz.querySelectorAll('[data-target]')) t.addEventListener('click', () => { pzTarget = t.dataset.target; syncMixer(); });
  pzRadius.addEventListener('input', () => setRadius(+pzRadius.value));
  for (const b of pz.querySelectorAll('[data-r]')) b.addEventListener('click', () => setRadius(+b.dataset.r));
  for (const b of pz.querySelectorAll('[data-font]')) b.addEventListener('click', () => {
    if (b.dataset.font === 'redondeada') delete theme.font; else theme.font = b.dataset.font;
    applySoon(); syncFonts();
  });
  pzName.addEventListener('input', () => {
    lsSet(LS_NAME, pzName.value.replace(/\s+/g, ' ').trim().slice(0, 24));
    lsSet(LS_NAME_ASKED, '1');
    showName();
  });
  pzName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pzName.blur(); } });

  function openPerso() {
    if (!nameBox.hidden) closeName();
    togglePanel(false);
    pzName.value = lsGet(LS_NAME) || '';
    syncPerso();
    pz.hidden = false;
    document.body.classList.add('perso-on');   // el botón flotante no tapa los controles
    holaBtn.setAttribute('aria-expanded', 'true');
    pz.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }
  function closePerso() {
    if (pz.hidden) return;
    pz.hidden = true;
    document.body.classList.remove('perso-on');
    holaBtn.setAttribute('aria-expanded', 'false');
    if (themeSaveTimer) saveTheme();
  }
  holaBtn.addEventListener('click', () => { if (pz.hidden) openPerso(); else closePerso(); });
  $('#pz-abrir').addEventListener('click', () => { openPerso(); if (!reduced()) window.scrollTo({ top: 0, behavior: 'smooth' }); else window.scrollTo(0, 0); });
  $('#perso-cerrar').addEventListener('click', closePerso);
  $('#pz-ok').addEventListener('click', closePerso);
  pz.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closePerso(); holaBtn.focus(); } });
  $('#pz-reset').addEventListener('click', () => {
    if (!Object.keys(theme).length) { toast('Ya tienes el diseño original.'); return; }
    const prev = Object.assign({}, theme);
    theme = {}; applyTheme(true); syncPerso();
    toast('Volviste al diseño original.', 'Deshacer', () => { theme = prev; applyTheme(true); syncPerso(); });
  });

  /* ---------- Arranque ---------- */

  // Primera vez que se abre la app: tareas de ejemplo para mostrar cómo funciona.
  function exampleTasks() {
    const t = ymd(new Date()), now = Date.now();
    const ex = (id, title, emoji, color, o, extra) => Object.assign({ id, title, emoji, color, priority: '', date: '', time: '', repeat: '',
      done: false, doneOn: '', order: o, createdAt: now, example: true, pinned: false, pinnedAt: 0 }, extra);
    return [
      ex('ej-viveres', 'Comprar víveres: leche, pan, frutas', '🛒', 'naranja', 1, { date: t, done: true, doneOn: t }),
      ex('ej-examen', 'Estudiar para el examen', '📚', 'verde', 2, { priority: 'alta', date: t, time: '20:00' }),
      ex('ej-gimnasio', 'Ir al gimnasio', '🏋️', 'azul', 3, { repeat: 'diaria', time: '07:00', done: true, doneOn: t }),
      ex('ej-plantas', 'Regar las plantas', '🌱', 'amarillo', 4, { priority: 'media' }),
    ];
  }
  function startLocal() {
    S.mode = 'local';
    let arr = [];
    try { const raw = lsGet(LS_TASKS); const parsed = raw === null ? exampleTasks() : JSON.parse(raw); if (Array.isArray(parsed)) arr = parsed; } catch (e) { arr = []; }
    S.server = new Map(arr.filter(x => x && typeof x.id === 'string').map(x => [x.id, normalize(x.id, x)]));
    saveLocal();
    renderAll();
    pushSetup();
    checkAlerts();
  }

  function onSnap(snap) {
    const m = new Map();
    for (const d of snap.docs) {
      if (!d.exists) continue;
      const x = d.data();
      if (x) m.set(d.id, normalize(d.id, x));
    }
    S.server = m;
    S.mode = 'db';
    if (S.editing && S.editing !== 'new' && !tasksView().has(S.editing)) closeEditor(true);
    renderAll();
  }
  function subscribe(attempt) {
    try {
      S.db.collection('tasks').onSnapshot(onSnap, err => {
        const code = err && err.code;
        if (code === 'unavailable' && attempt < 2) { setTimeout(() => subscribe(attempt + 1), 1500 + Math.random() * 1500); return; }
        if (code !== 'unavailable' && code !== 'resource_exhausted') S.canWrite = false;
        if (S.mode === 'loading') S.mode = 'db';
        toast('Se perdió la conexión con tu lista. Vuelve a abrir la página para reintentar.');
        renderAll();
      });
    } catch (e) { startLocal(); }
  }

  async function boot() {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') { startLocal(); return; }
    let db = null;
    try { db = await c.use('db'); } catch (e) { db = null; }
    if (!db) { startLocal(); return; }
    S.db = db;
    subscribe(0);
    try {
      const user = await c.use('user');
      if (user && typeof user.can === 'function') {
        const w = await user.can('data.write');
        if (w === false) { S.canWrite = false; closeEditor(true); renderAll(); }
      }
    } catch (e) { /* sin datos del usuario: se decide al escribir */ }
  }

  renderAll();
  boot();
})();

// Modo sin conexión: guarda la app en el celular la primera vez que se abre.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
