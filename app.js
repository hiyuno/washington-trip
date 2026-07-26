/* Washington Trip — planificador de ruta por el estado de Washington
 * Mapa: Leaflet + OpenStreetMap · Búsqueda: Nominatim · Rutas en coche: OSRM
 * Todo se guarda en localStorage. Sin backend.
 */
(() => {
'use strict';

// ───────────────────────────────────────── Config
const STORAGE_KEY = 'dctrip.state.v1';
const ROUTE_KEY   = 'dctrip.routes.v1';
const OSRM        = 'https://router.project-osrm.org';
const NOMINATIM   = 'https://nominatim.openstreetmap.org';
const WA_CENTER   = [47.45, -122.30];
const WA_VIEWBOX  = '-124.90,49.10,-116.90,45.50'; // izq,arriba,der,abajo — estado de Washington
const TRIP_FROM   = '2026-08-05';
const TRIP_TO     = '2026-08-10';
const MAX_ROUTE_CACHE = 200;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);

// ───────────────────────────────────────── Estado
function buildDays(from, to) {
  const days = [];
  const d = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  while (d <= end) {
    days.push(newDay(d.toISOString().slice(0, 10)));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
const newDay = (date) => ({ id: uid(), date, startTime: '09:00', start: null, end: null, stops: [] });

const blankState = () => ({ version: 1, name: 'Washington Trip', days: buildDays(TRIP_FROM, TRIP_TO) });

// La primera vez se arranca con el plan sugerido (plan.js); si no está, con el viaje vacío.
function defaultState() {
  try { return window.WA_PLAN ? window.WA_PLAN() : blankState(); }
  catch { return blankState(); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.days) || !s.days.length) return defaultState();
    s.days.forEach(d => {
      d.stops = Array.isArray(d.stops) ? d.stops : [];
      d.stops.forEach(st => { st.duration = Number.isFinite(st.duration) ? st.duration : 60; });
    });
    return s;
  } catch { return defaultState(); }
}

let state = loadState();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('No se pudo guardar (almacenamiento lleno)'); }
  }, 200);
}

const ALL = '__all__';                      // pseudo-día: la vista de todo el viaje
const STARS = '__stars__';                  // pseudo-día: solo los lugares marcados con ⭐
const isAll = () => ui.dayId === ALL;
const isStars = () => ui.dayId === STARS;
const isSpecial = () => isAll() || isStars();
const DAY_COLORS = ['#4c8dff', '#35d0a5', '#f7b955', '#ff6b8b', '#b06bff', '#37c8e0'];

const ui = {
  dayId: state.days[0].id,
  locked: localStorage.getItem('dctrip.locked') === '1',   // mapa fijo: no se reencuadra solo
  searchTarget: null,   // 'stop' | 'start' | 'end'
  editingStopId: null,
  pickOnMap: false,
  undo: null,
  routes: {},           // dayId -> {legs, coords}
  loadingRoute: false,
};

const day = () => state.days.find(d => d.id === ui.dayId) || state.days[0];

// ───────────────────────────────────────── Utilidades
function fmtDur(sec) {
  if (sec == null) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
}
const fmtKm = (m) => m == null ? '' : (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const toMin = (hhmm) => { const [h, m] = (hhmm || '09:00').split(':').map(Number); return h * 60 + m; };
function fmtClock(min) {
  const wrapped = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60), m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return { dow: dias[d.getDay()], short: `${d.getDate()} ${meses[d.getMonth()]}`, long: `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}` };
}

let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ───────────────────────────────────────── Caché de rutas
function loadRouteCache() {
  try { return JSON.parse(localStorage.getItem(ROUTE_KEY)) || {}; } catch { return {}; }
}
let routeCache = loadRouteCache();
function saveRouteCache() {
  const keys = Object.keys(routeCache);
  if (keys.length > MAX_ROUTE_CACHE) {
    keys.sort((a, b) => (routeCache[a].ts || 0) - (routeCache[b].ts || 0))
        .slice(0, keys.length - MAX_ROUTE_CACHE)
        .forEach(k => delete routeCache[k]);
  }
  try { localStorage.setItem(ROUTE_KEY, JSON.stringify(routeCache)); } catch { routeCache = {}; }
}
const routeKey = (pts) => pts.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|');

// ───────────────────────────────────────── Red: OSRM + Nominatim
async function getRoute(points) {
  if (points.length < 2) return null;
  const key = routeKey(points);
  if (routeCache[key]) return routeCache[key];
  if (!navigator.onLine) return null;

  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM ' + res.status);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error(data.code || 'sin ruta');

  const r = data.routes[0];
  const value = {
    legs: r.legs.map(l => ({ duration: l.duration, distance: l.distance })),
    coords: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    ts: Date.now(),
  };
  routeCache[key] = value;
  saveRouteCache();
  return value;
}

async function getDurationMatrix(points) {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
  const res = await fetch(`${OSRM}/table/v1/driving/${coords}?annotations=duration`);
  if (!res.ok) throw new Error('OSRM table ' + res.status);
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(data.code);
  return data.durations;
}

async function searchPlaces(q, signal) {
  const url = `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}` +
              `&limit=8&addressdetails=1&accept-language=es&viewbox=${WA_VIEWBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Nominatim ' + res.status);
  return (await res.json()).map(toPlace);
}

async function reverseGeocode(lat, lon) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nominatim ' + res.status);
  return toPlace(await res.json());
}

function toPlace(r) {
  const a = r.address || {};
  const short = r.name || (r.display_name || '').split(',')[0];
  const addr = [a.house_number && a.road ? `${a.road} ${a.house_number}` : a.road,
                a.neighbourhood || a.suburb, a.city || a.town || a.state]
                .filter(Boolean).join(', ');
  return {
    id: uid(),
    name: short || 'Sin nombre',
    address: addr || (r.display_name || '').split(',').slice(1, 4).join(',').trim(),
    lat: parseFloat(r.lat), lon: parseFloat(r.lon),
    duration: 60,
    notes: '',
    star: false,
  };
}

// ───────────────────────────────────────── Mapa
const map = L.map('map', { zoomControl: true, attributionControl: true, fadeAnimation: false }).setView(WA_CENTER, 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap · rutas OSRM',
}).addTo(map);

const layer = L.layerGroup().addTo(map);

// El contenedor puede medir 0×0 cuando se crea el mapa; entonces fitBounds se iría al zoom máximo.
// Se guarda el encuadre pendiente y se aplica en cuanto el mapa tiene tamaño real.
let pendingFit = null;
if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    map.invalidateSize({ animate: false });
    if (pendingFit && map.getSize().x > 0) { const p = pendingFit; pendingFit = null; applyFit(p.b, p.force); }
  }).observe($('#map'));
}

function pinIcon(label, kind, color) {
  const star = kind.includes('star') ? '<i class="star-badge">★</i>' : '';
  const bg = color ? ` style="background:${color}"` : '';
  return L.divIcon({
    className: '',
    html: `<div class="pin ${kind}"${bg}><span>${label}</span>${star}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 26],
  });
}

/** El color de un día: el mismo en su pestaña, en sus pines, en su ruta y en la vista "Todo". */
const dayColor = (d) => DAY_COLORS[Math.max(0, state.days.indexOf(d)) % DAY_COLORS.length];

function drawMap(seq, route, fit, color = DAY_COLORS[0]) {
  layer.clearLayers();
  if (route?.coords?.length) {
    L.polyline(route.coords, { color, weight: 5, opacity: .85 }).addTo(layer);
  } else if (seq.length > 1) {
    L.polyline(seq.map(n => [n.place.lat, n.place.lon]),
      { color, weight: 3, opacity: .45, dashArray: '6 8' }).addTo(layer);
  }
  let n = 0;
  seq.forEach(node => {
    const label = node.kind === 'start' ? 'A' : node.kind === 'end' ? '🛏' : String(++n);
    const kind = node.kind + (node.kind === 'stop' && node.place.star ? ' star' : '');
    // El inicio y la dormida mantienen su color propio: si no, no se distinguen del resto.
    const bg = node.kind === 'stop' ? color : null;
    L.marker([node.place.lat, node.place.lon], { icon: pinIcon(label, kind, bg) })
      .bindPopup(`<b>${escapeHtml(node.place.name)}</b><br><span style="color:#667">${escapeHtml(node.place.address || '')}</span>`)
      .addTo(layer);
  });
  if (fit && seq.length) fitTo(seq, route, fit === 'force');
}

function fitTo(seq, route, force) {
  const b = L.latLngBounds(seq.map(nd => [nd.place.lat, nd.place.lon]));
  if (route?.coords?.length) route.coords.forEach(c => b.extend(c));
  applyFit(b, force);
}

/** Encuadra el mapa. Con el mapa fijado solo obedece si el reencuadre lo pidió el usuario (force). */
function applyFit(b, force) {
  map.invalidateSize({ animate: false });
  if (!b || !b.isValid()) return;
  if (ui.locked && !force) return;
  if (!map.getSize().x) { pendingFit = { b, force }; return; } // todavía sin layout
  if (b.getNorthEast().equals(b.getSouthWest())) {
    map.setView(b.getCenter(), 15); // un solo punto: fitBounds se iría al zoom máximo
    return;
  }
  // En móvil el panel tapa la parte de abajo del mapa: se compensa con padding.
  // Hay que acotarlo — si el padding se come el alto entero, fitBounds se aleja muchísimo.
  let cover = 0;
  if (window.innerWidth < 900) {
    const m = $('#map').getBoundingClientRect(), s = $('#sheet').getBoundingClientRect();
    cover = Math.max(0, Math.min(Math.round(m.bottom - s.top), Math.round(m.height) - 150));
  }
  map.fitBounds(b, { paddingTopLeft: [36, 28], paddingBottomRight: [36, cover + 28], maxZoom: 16 });
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────────────────────────────────────── Modelo del día
function sequence(d) {
  const seq = [];
  if (d.start) seq.push({ kind: 'start', place: d.start, stay: 0 });
  d.stops.forEach(s => seq.push({ kind: 'stop', place: s, stay: s.duration || 0 }));
  if (d.end) seq.push({ kind: 'end', place: d.end, stay: 0 });
  return seq;
}

/** Devuelve horarios estimados por nodo a partir de la hora de salida y las duraciones de traslado. */
function timeline(d, route) {
  const seq = sequence(d);
  const legs = route?.legs || [];
  let t = toMin(d.startTime);
  return seq.map((node, i) => {
    let travel = null;
    if (i > 0) {
      travel = legs[i - 1] ? legs[i - 1].duration / 60 : null;
      t = travel == null ? null : (t == null ? null : t + travel);
    }
    const arrive = t;
    if (t != null) t += node.stay;
    return { ...node, arrive, depart: t, travelMin: travel, distance: i > 0 ? legs[i - 1]?.distance ?? null : null };
  });
}

// ───────────────────────────────────────── Render
function renderTabs() {
  const tabs = $('#dayTabs');
  tabs.innerHTML = '';

  const all = document.createElement('button');
  all.className = 'day-tab all' + (isAll() ? ' active' : '');
  all.innerHTML = `<b>Todo</b><small>${state.days.length} días</small>`;
  all.onclick = () => { ui.dayId = ALL; render(true); };
  tabs.appendChild(all);

  const stars = starredPlaces();
  if (stars.length) {
    const st = document.createElement('button');
    st.className = 'day-tab all star-tab' + (isStars() ? ' active' : '');
    st.innerHTML = `<b>⭐ Top</b><small>${stars.length} sitios</small>`;
    st.onclick = () => { ui.dayId = STARS; render(true); };
    tabs.appendChild(st);
  }

  state.days.forEach((d, i) => {
    const f = fmtDate(d.date);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day-tab' + (d.id === ui.dayId ? ' active' : '');
    b.dataset.dayId = d.id;
    b.title = 'Arrastra para mover el itinerario a otro día';
    const color = DAY_COLORS[i % DAY_COLORS.length];
    const dot = d.stops.length ? `<span class="dot" style="background:${color}"></span>` : '';
    b.innerHTML = `<b>Día ${i + 1}${dot}</b><small>${f.dow} ${f.short}</small>`;
    if (d.id === ui.dayId) b.style.cssText = `background:${color};border-color:${color};color:#08101f`;
    attachDayDrag(b);
    tabs.appendChild(b);
  });
  $('#tripTitle').textContent = state.name;
  const a = fmtDate(state.days[0].date), z = fmtDate(state.days.at(-1).date);
  $('#tripDates').textContent = `${a.short} – ${z.short}`;
}

function anchorRow(kind, place, timeStr) {
  const li = document.createElement('li');
  li.className = 'item anchor' + (kind === 'end' ? ' end-anchor' : '');
  li.dataset.kind = kind;
  const title = kind === 'start' ? 'Inicio del día' : 'Dónde duermo';
  if (place) {
    li.innerHTML = `
      <div class="idx">${kind === 'start' ? 'A' : '🛏'}</div>
      <div class="body">
        <div class="name">${escapeHtml(place.name)}</div>
        <div class="meta">${title}${place.address ? ' · ' + escapeHtml(place.address) : ''}</div>
      </div>
      <div class="time">${timeStr || ''}</div>
      <button class="set-btn" data-act="edit-anchor">Cambiar</button>`;
  } else {
    li.innerHTML = `
      <div class="idx">${kind === 'start' ? 'A' : '🛏'}</div>
      <div class="body"><div class="name muted">${title}</div>
      <div class="meta">Sin definir</div></div>
      <button class="set-btn" data-act="edit-anchor">Definir</button>`;
  }
  li.querySelector('[data-act=edit-anchor]').onclick = () => openSearch(kind);
  return li;
}

function legRow(node) {
  const div = document.createElement('li');
  const over = node.travelMin != null && node.travelMin > 120; // tramos largos de carretera
  div.className = 'leg' + (over ? ' warn' : '');
  div.innerHTML = node.travelMin == null
    ? `<span class="car">🚗</span><span>traslado sin calcular</span>`
    : `<span class="car">🚗</span><span>${fmtDur(node.travelMin * 60)}${node.distance != null ? ' · ' + fmtKm(node.distance) : ''}</span>`;
  return div;
}

function renderDay(fitMap) {
  const d = day();
  const idx = state.days.indexOf(d);
  const f = fmtDate(d.date);
  $('#dayTitle').textContent = `Día ${idx + 1} · ${f.dow} ${f.short}`;
  $('#startTime').value = d.startTime;

  const route = ui.routes[d.id] || null;
  const nodes = timeline(d, route);

  const list = $('#itinerary');
  list.innerHTML = '';

  // El inicio siempre encabeza la lista, aunque todavía no esté definido.
  if (!d.start) list.appendChild(anchorRow('start', null));

  nodes.forEach((node, i) => {
    if (i > 0) list.appendChild(legRow(node));
    const time = node.arrive != null ? fmtClock(node.arrive) : '';
    list.appendChild(node.kind === 'stop' ? stopRow(node, d) : anchorRow(node.kind, node.place, time));
  });

  if (!d.stops.length) {
    const hint = document.createElement('li');
    hint.className = 'empty-hint';
    hint.textContent = 'Todavía no hay paradas en este día.';
    list.appendChild(hint);
  }

  // La dormida siempre cierra la lista.
  if (!d.end) list.appendChild(anchorRow('end', null));

  // resumen
  const totalTravel = (route?.legs || []).reduce((a, l) => a + l.duration, 0);
  const totalDist = (route?.legs || []).reduce((a, l) => a + l.distance, 0);
  const last = nodes.at(-1);
  $('#daySummary').innerHTML = d.stops.length
    ? `${d.stops.length} parada${d.stops.length > 1 ? 's' : ''} · 🚗 ${route ? fmtDur(totalTravel) + ' · ' + fmtKm(totalDist) : (ui.loadingRoute ? '<span class="spinner"></span>' : '—')}`
    : 'Sin paradas todavía';
  const endMin = last?.arrive;
  $('#endTimeLabel').textContent = endMin != null
    ? (d.end ? `Llegas a dormir ${fmtClock(endMin)}` : `Terminas ${fmtClock(last.depart ?? endMin)}`)
    : '—';

  $('#btnOptimize').disabled = d.stops.length < 2;
  $('#btnUndo').hidden = !ui.undo || ui.undo.dayId !== d.id;
  $('#offlineNote').hidden = navigator.onLine;

  drawMap(sequence(d), route, fitMap, dayColor(d));
}

function stopRow(node, d) {
  const s = node.place;
  const li = document.createElement('li');
  li.className = 'item';
  li.dataset.kind = 'stop';
  li.dataset.id = s.id;
  const n = d.stops.indexOf(s) + 1;
  li.innerHTML = `
    <div class="idx" style="background:${dayColor(d)};color:#08101f">${n}</div>
    <div class="body">
      <div class="name">${s.star ? '⭐ ' : ''}${escapeHtml(s.name)}</div>
      <div class="meta">${s.duration || 0} min${s.address ? ' · ' + escapeHtml(s.address) : ''}${s.notes ? ' · 📝' : ''}</div>
    </div>
    <div class="time">${node.arrive != null ? fmtClock(node.arrive) : ''}</div>
    <div class="grip" title="Arrastra para reordenar">⣿</div>`;
  li.querySelector('.body').onclick = () => openStopEditor(s.id);
  li.querySelector('.idx').onclick = () => {
    map.setView([s.lat, s.lon], 16);
    if (window.innerWidth < 900) setSheet('collapsed');
  };
  attachDrag(li);
  return li;
}

let renderToken = 0;
async function render(fitMap = false) {
  renderTabs();
  $('#sheet').classList.toggle('overview', isSpecial());
  if (isStars()) return renderStars(fitMap);
  if (isAll()) return renderOverview(fitMap);

  renderDay(fitMap);
  const token = ++renderToken;
  const d = day();
  const pts = sequence(d).map(n => n.place);
  if (pts.length < 2) { ui.routes[d.id] = null; renderDay(fitMap); return; }

  const key = routeKey(pts);
  const cached = routeCache[key];
  if (cached) { ui.routes[d.id] = cached; renderDay(fitMap); return; }

  ui.loadingRoute = true;
  renderDay(false);
  try {
    const r = await getRoute(pts);
    if (token !== renderToken) return;
    ui.routes[d.id] = r;
    if (!r && !navigator.onLine) toast('Sin conexión: no puedo calcular esta ruta todavía');
  } catch (e) {
    if (token !== renderToken) return;
    ui.routes[d.id] = null;
    toast('No se pudo calcular la ruta: ' + e.message);
  } finally {
    if (token === renderToken) { ui.loadingRoute = false; renderDay(fitMap); }
  }
}

// ───────────────────────────────────────── Vista de los ⭐
/** Todas las paradas marcadas, en el orden en que las recorres. */
function starredPlaces() {
  const out = [];
  state.days.forEach((d, i) => d.stops.forEach(s => {
    if (s.star) out.push({ place: s, day: d, dayIndex: i, color: DAY_COLORS[i % DAY_COLORS.length] });
  }));
  return out;
}

function drawStars(fit) {
  layer.clearLayers();
  const b = L.latLngBounds([]);
  starredPlaces().forEach((x, n) => {
    L.marker([x.place.lat, x.place.lon], { icon: pinIcon(String(n + 1), 'stop star', x.color) })
      .bindPopup(`<b>${escapeHtml(x.place.name)}</b><br>` +
                 `<span style="color:#667">Día ${x.dayIndex + 1} · ${fmtDate(x.day.date).long}</span>`)
      .addTo(layer);
    b.extend([x.place.lat, x.place.lon]);
  });
  if (fit) applyFit(b, fit === 'force');
}

function renderStars(fitMap) {
  const stars = starredPlaces();
  const list = $('#itinerary');
  list.innerHTML = '';
  $('#dayTitle').textContent = '⭐ Lo que no te puedes perder';

  if (!stars.length) {
    const hint = document.createElement('li');
    hint.className = 'empty-hint';
    hint.textContent = 'Marca paradas como "Lugar principal" desde su editor y aparecerán aquí.';
    list.appendChild(hint);
  }

  stars.forEach((x, n) => {
    const f = fmtDate(x.day.date);
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div class="idx" style="background:${x.color};color:#08101f">${n + 1}</div>
      <div class="body">
        <div class="name">⭐ ${escapeHtml(x.place.name)}</div>
        <div class="meta">Día ${x.dayIndex + 1} · ${f.dow} ${f.short} · ${x.place.duration || 0} min${x.place.notes ? ' · 📝' : ''}</div>
      </div>
      <button class="set-btn" data-goto="${x.day.id}">Ver día →</button>`;
    li.onclick = () => {                      // tocar la fila: centrar el mapa en ese sitio
      map.setView([x.place.lat, x.place.lon], 13);
      if (window.innerWidth < 900) setSheet('collapsed');
    };
    li.querySelector('[data-goto]').onclick = (ev) => {
      ev.stopPropagation();
      ui.dayId = x.day.id;
      render(true);
    };
    list.appendChild(li);
  });

  const dias = new Set(stars.map(x => x.dayIndex)).size;
  $('#daySummary').textContent = stars.length
    ? `${stars.length} sitios repartidos en ${dias} día${dias === 1 ? '' : 's'} · tócalos para verlos en el mapa`
    : 'Todavía no has marcado ninguno';
  $('#endTimeLabel').textContent = '';
  $('#btnUndo').hidden = true;
  $('#offlineNote').hidden = navigator.onLine;

  drawStars(fitMap);
}

// ───────────────────────────────────────── Vista de todo el viaje
const samePlace = (a, b) =>
  !!a && !!b && Math.abs(a.lat - b.lat) < 0.003 && Math.abs(a.lon - b.lon) < 0.003; // ~300 m

function drawAll(fit) {
  layer.clearLayers();
  const b = L.latLngBounds([]);
  state.days.forEach((d, i) => {
    const seq = sequence(d);
    if (!seq.length) return;
    const color = DAY_COLORS[i % DAY_COLORS.length];
    const route = ui.routes[d.id];

    if (route?.coords?.length) {
      L.polyline(route.coords, { color, weight: 4, opacity: .85 }).addTo(layer);
      route.coords.forEach(c => b.extend(c));
    } else if (seq.length > 1) {
      L.polyline(seq.map(n => [n.place.lat, n.place.lon]),
        { color, weight: 2, opacity: .5, dashArray: '6 8' }).addTo(layer);
    }
    seq.forEach(n => b.extend([n.place.lat, n.place.lon]));

    // Solo el principio y el final de cada día: es lo que deja ver cómo enlazan.
    const mark = (node, role) => L.marker([node.place.lat, node.place.lon], {
      icon: L.divIcon({
        className: '',
        html: `<div class="pin daypin ${role}" style="background:${color}"><span>${i + 1}</span></div>`,
        iconSize: [26, 26], iconAnchor: [13, 24],
      }),
    }).bindPopup(`<b>Día ${i + 1}</b> · ${role === 'a' ? 'sale de' : 'duerme en'}<br>${escapeHtml(node.place.name)}`)
      .addTo(layer);

    mark(seq[0], 'a');
    if (seq.length > 1) mark(seq.at(-1), 'z');
  });
  if (fit) applyFit(b, fit === 'force');
}

function renderOverview(fitMap) {
  const list = $('#itinerary');
  list.innerHTML = '';
  $('#dayTitle').textContent = 'Todo el viaje';

  let totalDrive = 0, totalDist = 0;
  state.days.forEach((d, i) => {
    const route = ui.routes[d.id];
    const seq = sequence(d);
    const drive = (route?.legs || []).reduce((a, l) => a + l.duration, 0);
    totalDrive += drive;
    totalDist += (route?.legs || []).reduce((a, l) => a + l.distance, 0);
    const f = fmtDate(d.date);
    const color = DAY_COLORS[i % DAY_COLORS.length];

    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = `
      <div class="idx" style="background:${color};color:#08101f">${i + 1}</div>
      <div class="body">
        <div class="name">${f.dow} ${f.short}${d.stops.some(s => s.star) ? ' ⭐' : ''}</div>
        <div class="meta">${seq.length
          ? `${escapeHtml(d.start?.name || '—')} → ${escapeHtml(d.end?.name || '—')} · ${d.stops.length} parada${d.stops.length === 1 ? '' : 's'}`
          : 'Día sin nada planeado'}</div>
      </div>
      <div class="time">${route ? fmtDur(drive) : (ui.loadingRoute ? '<span class="spinner"></span>' : '—')}</div>`;
    li.onclick = () => { ui.dayId = d.id; render(true); };
    list.appendChild(li);

    // Enlace con el día siguiente: es el punto de la vista.
    const next = state.days[i + 1];
    if (!next) return;
    const join = document.createElement('li');
    if (!d.end || !next.start) {
      join.className = 'leg join warn';
      join.innerHTML = `<span>⚠︎ falta ${!d.end ? `la dormida del día ${i + 1}` : `el inicio del día ${i + 2}`}</span>`;
    } else if (samePlace(d.end, next.start)) {
      join.className = 'leg join ok';
      join.innerHTML = `<span>🛏 duerme en ${escapeHtml(d.end.name)} y sigue desde ahí</span>`;
    } else {
      join.className = 'leg join warn';
      join.innerHTML = `<span>⚠︎ termina en ${escapeHtml(d.end.name)} pero el día ${i + 2} arranca en ${escapeHtml(next.start.name)}</span>
                        <button class="set-btn" data-link="${i}">Enlazar</button>`;
      join.querySelector('[data-link]').onclick = (ev) => {
        ev.stopPropagation();
        next.start = { ...d.end, id: uid() };
        save(); render(false);
        toast(`Día ${i + 2} arranca ahora en ${d.end.name}`);
      };
    }
    list.appendChild(join);
  });

  $('#daySummary').innerHTML = `${state.days.length} días · 🚗 ${fmtDur(totalDrive)} · ${fmtKm(totalDist)} en total`;
  $('#endTimeLabel').textContent = '';
  $('#btnUndo').hidden = true;
  $('#offlineNote').hidden = navigator.onLine;

  drawAll(fitMap);
  ensureAllRoutes(fitMap);
}

/** Calcula las rutas que falten de todos los días, de una en una para no saturar OSRM. */
async function ensureAllRoutes(fitMap) {
  const token = ++renderToken;
  let pending = false;
  for (const d of state.days) {
    const pts = sequence(d).map(n => n.place);
    if (pts.length < 2) { ui.routes[d.id] = null; continue; }
    const cached = routeCache[routeKey(pts)];
    if (cached) { ui.routes[d.id] = cached; continue; }
    if (!navigator.onLine) continue;
    pending = true;
    ui.loadingRoute = true;
    try {
      const r = await getRoute(pts);
      if (token !== renderToken) return;
      ui.routes[d.id] = r;
    } catch { if (token !== renderToken) return; ui.routes[d.id] = null; }
  }
  if (token !== renderToken) return;
  ui.loadingRoute = false;
  if (pending && isAll()) renderOverview(fitMap);
}

// ───────────────────────────────────────── Reordenar días (arrastra la pestaña)
/** Mueve el itinerario entre fechas: las fechas del viaje se quedan, cambia el contenido. */
function applyDayOrder(orderIds) {
  const byId = Object.fromEntries(state.days.map(d => [d.id, d]));
  const reordered = orderIds.map(id => byId[id]).filter(Boolean);
  if (reordered.length !== state.days.length) return false;
  const changed = reordered.some((d, i) => d !== state.days[i]);
  if (!changed) return false;
  const dates = state.days.map(d => d.date);
  state.days = reordered;
  state.days.forEach((d, i) => { d.date = dates[i]; });
  return true;
}

function attachDayDrag(b) {
  b.addEventListener('pointerdown', (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    const tabs = $('#dayTabs');
    const dayId = b.dataset.dayId;
    const pid = ev.pointerId;
    let startX = ev.clientX;
    let dragging = false;

    const dayTabs = () => $$('.day-tab[data-day-id]', tabs);

    const move = (e) => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < 8) return;
        dragging = true;
        tabs.classList.add('dragging-mode');
        b.classList.add('dragging');
        try { b.setPointerCapture(pid); } catch { /* ignore */ }
      }
      e.preventDefault();
      b.style.transform = `translateX(${e.clientX - startX}px)`;

      for (let pass = 0; pass < 20; pass++) {
        const r = b.getBoundingClientRect();
        const center = r.left + r.width / 2;
        const other = dayTabs().find(x => {
          if (x === b) return false;
          const o = x.getBoundingClientRect();
          return center > o.left && center < o.right;
        });
        if (!other) break;
        const o = other.getBoundingClientRect();
        const before = r.left;
        tabs.insertBefore(b, center > o.left + o.width / 2 ? other.nextSibling : other);
        const shift = b.getBoundingClientRect().left - before;
        if (!shift) break;
        startX += shift;
        b.style.transform = `translateX(${e.clientX - startX}px)`;
      }

      const box = tabs.getBoundingClientRect();
      if (e.clientX > box.right - 48) tabs.scrollLeft += 14;
      else if (e.clientX < box.left + 48) tabs.scrollLeft -= 14;
    };

    const up = (e) => {
      if (e && e.pointerId !== undefined && e.pointerId !== pid) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      b.style.transform = '';
      b.classList.remove('dragging');
      tabs.classList.remove('dragging-mode');

      if (!dragging) {
        ui.dayId = dayId;
        render(true);
        return;
      }

      const order = dayTabs().map(x => x.dataset.dayId);
      if (applyDayOrder(order)) { save(); render(true); }
      else render();
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

// ───────────────────────────────────────── Reordenar paradas (mouse + touch)
function attachDrag(li) {
  const grip = li.querySelector('.grip');
  if (!grip) return;
  grip.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const list = $('#itinerary');
    list.classList.add('dragging-mode');
    li.classList.add('dragging');
    grip.setPointerCapture(ev.pointerId);

    let startY = ev.clientY;
    const pid = ev.pointerId;
    const rows = () => $$('.item[data-kind="stop"]', list);

    const move = (e) => {
      if (e.pointerId !== pid) return;
      li.style.transform = `translateY(${e.clientY - startY}px)`;
      // Se repite hasta que no haya más intercambios: así un arrastre rápido puede
      // saltar varias posiciones aunque llegue un solo evento de movimiento.
      for (let pass = 0; pass < 20; pass++) {
        const r = li.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const other = rows().find(x => {
          if (x === li) return false;
          const o = x.getBoundingClientRect();
          return center > o.top && center < o.bottom;
        });
        if (!other) break;
        const o = other.getBoundingClientRect();
        const before = r.top;
        list.insertBefore(li, center > o.top + o.height / 2 ? other.nextSibling : other);
        const shift = li.getBoundingClientRect().top - before;
        if (!shift) break;
        startY += shift;
        li.style.transform = `translateY(${e.clientY - startY}px)`;
      }
    };

    const up = (e) => {
      if (e && e.pointerId !== undefined && e.pointerId !== pid) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      li.style.transform = '';
      li.classList.remove('dragging');
      list.classList.remove('dragging-mode');

      const order = rows().map(x => x.dataset.id);
      const d = day();
      const byId = Object.fromEntries(d.stops.map(s => [s.id, s]));
      const reordered = order.map(id => byId[id]).filter(Boolean);
      if (reordered.length === d.stops.length) {
        const changed = reordered.some((s, i) => s !== d.stops[i]);
        d.stops = reordered;
        if (changed) { save(); render(); return; }
      }
      render();
    };

    // En window, no en el asa: al reordenar el nodo en el DOM se pierde la captura del puntero.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

// ───────────────────────────────────────── Optimizar
function pathCost(m, order, endIdx) {
  let c = 0;
  for (let i = 0; i < order.length - 1; i++) c += m[order[i]][order[i + 1]];
  if (endIdx != null) c += m[order.at(-1)][endIdx];
  return c;
}

function optimizeOrder(m, movableIdx, startIdx, endIdx) {
  // vecino más cercano
  const remaining = new Set(movableIdx);
  let order = [startIdx], cur = startIdx;
  while (remaining.size) {
    let best = null, bestD = Infinity;
    for (const i of remaining) {
      const d = m[cur][i] + (remaining.size === 1 && endIdx != null ? m[i][endIdx] : 0);
      if (d < bestD) { bestD = d; best = i; }
    }
    order.push(best); remaining.delete(best); cur = best;
  }
  // 2-opt sobre el tramo movible
  let improved = true, guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 1; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
        if (pathCost(m, cand, endIdx) < pathCost(m, order, endIdx) - 1) { order = cand; improved = true; }
      }
    }
  }
  return order.slice(1);
}

async function optimizeDay() {
  const d = day();
  if (d.stops.length < 2) return;
  if (!navigator.onLine) { toast('Necesitas conexión para optimizar'); return; }

  const btn = $('#btnOptimize');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    let movable = d.stops.slice();
    let lockedFirst = null;
    let startPlace = d.start;
    if (!startPlace) { lockedFirst = movable.shift(); startPlace = lockedFirst; }
    if (movable.length < 2) { toast('Con estas paradas no hay nada que reordenar'); return; }

    const pts = [startPlace, ...movable];
    if (d.end) pts.push(d.end);
    const m = await getDurationMatrix(pts);
    const endIdx = d.end ? pts.length - 1 : null;
    const movableIdx = movable.map((_, i) => i + 1);

    const before = pathCost(m, [0, ...movableIdx], endIdx);
    const order = optimizeOrder(m, movableIdx, 0, endIdx);
    const after = pathCost(m, [0, ...order], endIdx);

    ui.undo = { dayId: d.id, stops: d.stops.slice() };
    d.stops = (lockedFirst ? [lockedFirst] : []).concat(order.map(i => movable[i - 1]));
    save();
    await render(true);
    const saved = before - after;
    toast(saved > 60 ? `Listo: ahorras ${fmtDur(saved)} de coche` : 'Ya estaba bien ordenado');
  } catch (e) {
    toast('No se pudo optimizar: ' + e.message);
  } finally {
    btn.innerHTML = 'Optimizar';
    btn.disabled = day().stops.length < 2;
  }
}

// ───────────────────────────────────────── Buscador
let searchAbort = null, searchTimer = null;

function openSearch(target) {
  ui.searchTarget = target;
  $('#searchTitle').textContent = target === 'start' ? 'Inicio del día'
                                : target === 'end' ? 'Dónde duermo esta noche'
                                : 'Agregar parada';
  $('#searchInput').value = '';
  $('#searchResults').innerHTML = '';
  openModal('searchModal');
  setTimeout(() => $('#searchInput').focus(), 60);
}

function runSearch(q) {
  const box = $('#searchResults');
  if (q.trim().length < 3) { box.innerHTML = ''; return; }
  if (!navigator.onLine) {
    box.innerHTML = '<li class="r-empty">Sin conexión: no puedo buscar lugares nuevos.</li>';
    return;
  }
  box.innerHTML = '<li class="r-empty"><span class="spinner"></span> Buscando…</li>';
  searchAbort?.abort();
  searchAbort = new AbortController();
  searchPlaces(q, searchAbort.signal)
    .then(list => {
      if (!list.length) { box.innerHTML = '<li class="r-empty">Sin resultados. Prueba con otro nombre.</li>'; return; }
      box.innerHTML = '';
      list.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="r-name">${escapeHtml(p.name)}</div><div class="r-addr">${escapeHtml(p.address)}</div>`;
        li.onclick = () => acceptPlace(p);
        box.appendChild(li);
      });
    })
    .catch(e => { if (e.name !== 'AbortError') box.innerHTML = `<li class="r-empty">Error al buscar: ${escapeHtml(e.message)}</li>`; });
}

function acceptPlace(p) {
  const d = day();
  if (ui.searchTarget === 'start') d.start = p;
  else if (ui.searchTarget === 'end') d.end = p;
  else d.stops.push(p);
  save();
  closeModal('searchModal');
  render(true);
  toast(`${p.name} agregado`);
}

// ───────────────────────────────────────── Editor de parada
function openStopEditor(id) {
  const d = day();
  const s = d.stops.find(x => x.id === id);
  if (!s) return;
  ui.editingStopId = id;
  $('#stopModalTitle').textContent = s.name;
  $('#stopName').value = s.name;
  $('#stopDuration').value = s.duration ?? 60;
  $('#stopStar').checked = !!s.star;
  $('#stopNotes').value = s.notes || '';
  const sel = $('#stopMoveDay');
  sel.innerHTML = '';
  state.days.forEach((dd, i) => {
    const f = fmtDate(dd.date);
    const o = document.createElement('option');
    o.value = dd.id;
    o.textContent = `Día ${i + 1} · ${f.dow} ${f.short}`;
    o.selected = dd.id === d.id;
    sel.appendChild(o);
  });
  openModal('stopModal');
}

function saveStopEditor() {
  const d = day();
  const s = d.stops.find(x => x.id === ui.editingStopId);
  if (!s) return closeModal('stopModal');
  s.name = $('#stopName').value.trim() || s.name;
  s.duration = Math.max(0, parseInt($('#stopDuration').value, 10) || 0);
  s.star = $('#stopStar').checked;
  s.notes = $('#stopNotes').value.trim();
  const targetId = $('#stopMoveDay').value;
  if (targetId !== d.id) {
    d.stops = d.stops.filter(x => x.id !== s.id);
    state.days.find(x => x.id === targetId).stops.push(s);
    toast('Movido de día');
  }
  save();
  closeModal('stopModal');
  render();
}

function deleteStop() {
  const d = day();
  d.stops = d.stops.filter(x => x.id !== ui.editingStopId);
  save();
  closeModal('stopModal');
  render(true);
}

// ───────────────────────────────────────── Modales y sheet
function openModal(id) { $('#' + id).hidden = false; }
function closeModal(id) { $('#' + id).hidden = true; }

function setSheet(mode) {
  const sh = $('#sheet');
  sh.classList.remove('expanded', 'collapsed');
  if (mode !== 'half') sh.classList.add(mode);
  setTimeout(() => map.invalidateSize(), 240);
}

function initSheetDrag() {
  const handle = $('#sheetHandle'), sh = $('#sheet');
  let startY = 0, startH = 0, dragging = false;
  handle.addEventListener('pointerdown', e => {
    if (window.innerWidth >= 900) return;
    dragging = true; startY = e.clientY; startH = sh.getBoundingClientRect().height;
    handle.setPointerCapture(e.pointerId);
    sh.style.transition = 'none';
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const h = Math.min(window.innerHeight - 40, Math.max(92, startH - (e.clientY - startY)));
    sh.style.height = h + 'px';
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    const h = sh.getBoundingClientRect().height, vh = window.innerHeight;
    sh.style.transition = '';
    sh.style.height = '';
    setSheet(h > vh * .68 ? 'expanded' : h < vh * .28 ? 'collapsed' : 'half');
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('click', () => {
    if (window.innerWidth >= 900) return;
    setSheet(sh.classList.contains('expanded') ? 'half' : 'expanded');
  });
}

// ───────────────────────────────────────── Export / import
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importJSON(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const s = JSON.parse(fr.result);
      if (!Array.isArray(s.days) || !s.days.length) throw new Error('formato no reconocido');
      state = s;
      state.days.forEach(d => { d.stops = d.stops || []; });
      ui.dayId = state.days[0].id;
      ui.routes = {};
      save();
      closeModal('menuModal');
      render(true);
      toast('Itinerario importado');
    } catch (e) { toast('Archivo inválido: ' + e.message); }
  };
  fr.readAsText(file);
}

// ───────────────────────────────────────── Eventos
$('#startTime').onchange = (e) => { day().startTime = e.target.value; save(); renderDay(false); };
$('#btnAddStop').onclick = () => openSearch('stop');
$('#btnOptimize').onclick = optimizeDay;
$('#btnUndo').onclick = () => {
  if (!ui.undo) return;
  const d = state.days.find(x => x.id === ui.undo.dayId);
  if (d) d.stops = ui.undo.stops;
  ui.undo = null; save(); render(true);
};
$('#btnFit').onclick = () => render('force');   // reencuadrar siempre obedece, aunque esté fijado
$('#btnLock').onclick = () => {
  ui.locked = !ui.locked;
  localStorage.setItem('dctrip.locked', ui.locked ? '1' : '0');
  renderLock();
  toast(ui.locked
    ? 'Mapa fijo: no se moverá al cambiar de día'
    : 'Mapa libre: se reencuadra en cada día');
  if (!ui.locked) render(true);
};
function renderLock() {
  const b = $('#btnLock');
  b.textContent = ui.locked ? '🔒' : '🔓';
  b.classList.toggle('active', ui.locked);
  b.title = ui.locked ? 'Mapa fijo — tócalo para liberarlo' : 'Fijar el mapa en su sitio';
}
$('#btnMenu').onclick = () => { $('#tripNameInput').value = state.name; openModal('menuModal'); };
$('#btnSaveStop').onclick = saveStopEditor;
$('#btnDeleteStop').onclick = deleteStop;
$('#btnExport').onclick = exportJSON;
$('#btnImport').onclick = () => $('#importFile').click();
$('#importFile').onchange = (e) => e.target.files[0] && importJSON(e.target.files[0]);
$('#tripNameInput').oninput = (e) => { state.name = e.target.value || 'Washington Trip'; save(); renderTabs(); };
$('#btnUpdate').onclick = async () => {
  const btn = $('#btnUpdate');
  btn.innerHTML = '<span class="spinner"></span> Buscando…';
  try {
    // Se tira el service worker y sus cachés: el itinerario vive en localStorage y no se toca.
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('watrip-shell')).map(k => caches.delete(k)));
    location.reload();
  } catch {
    btn.textContent = '↻ Buscar actualización';
    toast('No se pudo comprobar. ¿Estás sin conexión?');
  }
};
$('#btnLoadPlan').onclick = () => {
  if (!window.WA_PLAN) { toast('El plan sugerido no está disponible'); return; }
  if (!confirm('Esto reemplaza tu itinerario actual por el plan sugerido. ¿Seguir?')) return;
  state = window.WA_PLAN();
  ui.dayId = state.days[0].id;
  ui.routes = {};
  save(); closeModal('menuModal'); render(true);
  toast('Plan sugerido cargado');
};
$('#btnAddDay').onclick = () => {
  const last = state.days.at(-1);
  const nd = new Date(last.date + 'T12:00:00');
  nd.setDate(nd.getDate() + 1);
  const d = newDay(nd.toISOString().slice(0, 10));
  d.start = last.end || last.start;
  d.end = last.end;
  state.days.push(d);
  ui.dayId = d.id;
  save(); closeModal('menuModal'); render(true);
};
$('#btnDeleteDay').onclick = () => {
  if (state.days.length < 2) { toast('Tiene que quedar al menos un día'); return; }
  const d = day();
  if (!confirm(`¿Eliminar el ${fmtDate(d.date).long} con sus ${d.stops.length} paradas?`)) return;
  const i = state.days.indexOf(d);
  state.days.splice(i, 1);
  ui.dayId = state.days[Math.min(i, state.days.length - 1)].id;
  save(); closeModal('menuModal'); render(true);
};
$('#btnReset').onclick = () => {
  if (!confirm('¿Borrar todo el itinerario y volver a empezar?')) return;
  state = blankState();
  ui.dayId = state.days[0].id;
  ui.routes = {};
  save(); closeModal('menuModal'); render(true);
};

$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value;
  searchTimer = setTimeout(() => runSearch(q), 550); // respeta el límite de Nominatim
});

$$('[data-close-modal]').forEach(b => b.onclick = () => closeModal(b.dataset.closeModal));
$$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));

window.addEventListener('online', () => { $('#offlineNote').hidden = true; render(); });
window.addEventListener('offline', () => { $('#offlineNote').hidden = false; });
window.addEventListener('resize', () => map.invalidateSize());

// ───────────────────────────────────────── Arranque
initSheetDrag();
renderLock();
render(true);
map.whenReady(() => setTimeout(() => map.invalidateSize(), 100));
// El panel cambia de alto mientras se pinta el itinerario: se reencuadra una vez ya asentado.
setTimeout(() => { if (!isSpecial()) fitTo(sequence(day()), ui.routes[day().id]); }, 400);

// Expuesto solo para depurar desde la consola.
window.DCTrip = { map, render, get state() { return state; }, get ui() { return ui; } };

if ('serviceWorker' in navigator) {
  // Si entra a mandar un service worker nuevo, se recarga una vez para no quedarse
  // con una mezcla de versiones (HTML nuevo con JS viejo).
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    location.reload();
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
