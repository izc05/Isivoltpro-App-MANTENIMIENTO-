/* ═══════════════════════════════════════════════════════════
   ISIVOLT PRO — App Core
   Router · Estado global · Módulos · PDF Engine
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════
   1. ESTADO GLOBAL
══════════════════════════════════════════════════════════ */
const App = {
  page:   'inicio',
  theme:  localStorage.getItem('ivp_theme')  || 'dark',
  accent: localStorage.getItem('ivp_accent') || 'blue',
  fotos:  [],
  editingInstId: '',
  instPhotoB64:  '',
  lastPdfUrl:    null,
  lastPdfName:   '',
  draftTimer:    null,
  calYear:  new Date().getFullYear(),
  calMonth: new Date().getMonth(),
};

/* ══════════════════════════════════════════════════════════
   2. ARRANQUE
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  DB.loadGitHubConfig();
  await DB.init();
  applyTheme();
  applyAccent(App.accent, false);
  initDate();
  initDraft();
  initMotion();
  populateInstSelect();
  renderAll();
  loadChecklistBySpecialty();
  document.getElementById('f-esp')?.addEventListener('change', loadChecklistBySpecialty);
  document.getElementById('f-prioridad')?.addEventListener('change', updatePrioIndicator);
  setTimeout(updatePrioIndicator, 50);
  updateOTBadge();
  toast('IsiVoltPro listo.');
});

function renderAll() {
  renderHome();
  renderHistorial();
  renderOTList();
  renderCalGrid();
  renderInstalaciones();
  renderStats();
}

/* ══════════════════════════════════════════════════════════
   3. ROUTER
══════════════════════════════════════════════════════════ */
function goPage(id) {
  App.page = id;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  ['inicio','informes','ot','instalaciones','ajustes'].forEach(n => {
    document.getElementById('nb-' + n)?.classList.toggle('active', n === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  initMotion();
  if (id === 'historial')    renderHistorial();
  if (id === 'ot')           { renderOTList(); renderCalGrid(); }
  if (id === 'instalaciones'){ renderInstalaciones(); }
  if (id === 'stats')        renderStats();
  if (id === 'historial')    renderHistorial();
  if (id === 'inicio')       renderHome();
}

/* ══════════════════════════════════════════════════════════
   4. TEMA Y ACENTO
══════════════════════════════════════════════════════════ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', App.theme);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = App.theme === 'dark' ? '☀' : '🌙';
}
function toggleTheme() {
  App.theme = App.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ivp_theme', App.theme);
  applyTheme();
}

const ACCENTS = {
  blue:   { acc: '#2f7ef5', acc2: '#1a5fd4', g: 'rgba(47,126,245,.20)',  s: 'rgba(47,126,245,.10)' },
  green:  { acc: '#00b37e', acc2: '#0b8f67', g: 'rgba(0,179,126,.20)',   s: 'rgba(0,179,126,.10)' },
  orange: { acc: '#ff9f2e', acc2: '#d97706', g: 'rgba(255,159,46,.20)',  s: 'rgba(255,159,46,.10)' },
  violet: { acc: '#8b5cf6', acc2: '#6d28d9', g: 'rgba(139,92,246,.20)',  s: 'rgba(139,92,246,.10)' },
};
function applyAccent(name, save = true) {
  const cfg = ACCENTS[name] || ACCENTS.blue;
  const r = document.documentElement;
  r.style.setProperty('--acc',  cfg.acc);
  r.style.setProperty('--acc2', cfg.acc2);
  r.style.setProperty('--acc-g', cfg.g);
  r.style.setProperty('--acc-s', cfg.s);
  if (save) { App.accent = name; localStorage.setItem('ivp_accent', name); }
  document.querySelectorAll('.color-chip').forEach(b => b.classList.toggle('active', b.dataset.accent === name));
  toast('Color actualizado.');
}

/* ══════════════════════════════════════════════════════════
   5. TIPO (Correctivo / Preventivo)
══════════════════════════════════════════════════════════ */
function setTipo(card) {
  const tipo = card?.dataset?.tipo || 'averia';
  document.querySelectorAll('.tipo-card').forEach(c => c.classList.remove('active'));
  card?.classList.add('active');
  const pr   = document.getElementById('f-prioridad');
  const otst = document.getElementById('f-otestado');
  const freq = document.getElementById('f-freq');
  if (tipo === 'preventivo') {
    if (otst && (otst.value === 'Borrador' || !otst.value)) otst.value = 'Planificada';
    if (freq && !freq.value) freq.value = 'Mensual';
    if (pr && !pr.value) pr.value = 'MEDIA';
  } else {
    if (pr && !pr.value) pr.value = 'ALTA';
  }
  loadChecklistBySpecialty();
}

/* ══════════════════════════════════════════════════════════
   6. PRIORIDAD — indicador visual
══════════════════════════════════════════════════════════ */
const PRIO_CFG = {
  URGENTE: { emoji: '🔴', label: 'PRIORIDAD URGENTE', desc: 'Riesgo para personas o parada crítica. Actuar de inmediato.', css: 'pu' },
  ALTA:    { emoji: '🟠', label: 'PRIORIDAD ALTA',    desc: 'Afecta al servicio normal. Resolver cuanto antes.',           css: 'pa' },
  MEDIA:   { emoji: '🔵', label: 'PRIORIDAD MEDIA',   desc: 'Incidencia importante, atención no inmediata.',              css: 'pm' },
  BAJA:    { emoji: '⚪', label: 'PRIORIDAD BAJA',    desc: 'Mejora o ajuste menor. Sin impacto operativo grave.',        css: 'pb' },
};
function updatePrioIndicator() {
  const val = document.getElementById('f-prioridad')?.value?.toUpperCase() || 'MEDIA';
  const cfg = PRIO_CFG[val] || PRIO_CFG.MEDIA;
  const box = document.getElementById('prio-indicator');
  if (!box) return;
  box.style.background   = `var(--${cfg.css}-s)`;
  box.style.borderColor  = `var(--${cfg.css})`;
  box.querySelector('.pi-icon').textContent  = cfg.emoji;
  const lbl = box.querySelector('.pi-label');
  lbl.textContent  = cfg.label;
  lbl.style.color  = `var(--${cfg.css})`;
  box.querySelector('.pi-desc').textContent  = cfg.desc;
}

/* ══════════════════════════════════════════════════════════
   7. FOTOS
══════════════════════════════════════════════════════════ */
function addFotos(e) {
  const files = [...e.target.files];
  const rem = 6 - App.fotos.length;
  if (rem <= 0) { toast('Máximo 6 fotos.'); return; }
  Promise.all(files.slice(0, rem).map(f => compressImage(f, 1200, .72)))
    .then(results => {
      results.forEach((b64, i) => App.fotos.push({ b64, name: files[i].name }));
      renderFotos(); toast(`${results.length} foto(s) añadida(s).`);
    }).catch(() => toast('Error procesando alguna foto.'));
  e.target.value = '';
}
function removeFoto(i) { App.fotos.splice(i, 1); renderFotos(); }
function renderFotos() {
  const grid  = document.getElementById('foto-grid');
  const drop  = document.getElementById('foto-drop');
  const badge = document.getElementById('foto-badge');
  if (!grid) return;
  drop.classList.toggle('has', App.fotos.length > 0);
  grid.innerHTML = App.fotos.map((f, i) => `
    <div class="foto-item">
      <img src="${f.b64}" alt="foto ${i+1}">
      <button class="foto-rm" onclick="removeFoto(${i})">✕</button>
    </div>`).join('');
  if (badge) { badge.textContent = App.fotos.length || ''; badge.style.display = App.fotos.length ? 'block' : 'none'; }
}

/* ══════════════════════════════════════════════════════════
   8. PLANTILLAS RÁPIDAS
══════════════════════════════════════════════════════════ */
const TEMPLATES = {
  luminaria: { elem:'Luminaria / equipo de alumbrado', causas:'Fallo en elemento de iluminación por agotamiento o avería interna.', actuacion:'Se revisa el equipo, se sustituye el elemento defectuoso y se verifica funcionamiento correcto.', comprob:'Prueba de encendido y funcionamiento en condiciones normales.', recom:'Seguimiento si existen más luminarias con síntomas similares.', riesgo:'Pérdida de iluminación en zona de trabajo o paso.' },
  cerradura: { elem:'Puerta / cerradura eléctrica', causas:'Fallo mecánico o eléctrico del sistema de cierre.', actuacion:'Se desmonta, sustituye o ajusta el elemento defectuoso. Queda operativo.', comprob:'Verificación de apertura y cierre desde los puntos de uso.', recom:'Revisar desgaste si se repite la incidencia.', riesgo:'Afectación al control de accesos.' },
  fontaneria:{ elem:'Instalación de fontanería', causas:'Fuga, desgaste de junta o mal funcionamiento del elemento hidráulico.', actuacion:'Se localiza, corrige el punto y se restablece el servicio.', comprob:'Prueba de funcionamiento y comprobación de ausencia de fugas.', recom:'Vigilar el punto reparado durante los próximos días.', riesgo:'Pérdidas de agua o afectación al servicio.' },
  clima:     { elem:'Equipo de climatización / ventilación', causas:'Fallo eléctrico, suciedad o desgaste del componente.', actuacion:'Se revisa el equipo, se corrige la anomalía y queda operativo.', comprob:'Prueba de marcha y verificación básica de funcionamiento.', recom:'Mantener seguimiento preventivo.', riesgo:'Pérdida de confort o afección al servicio.' },
  gases:     { elem:'Instalación de gases medicinales', causas:'Incidencia en ramal, válvula o punto de consumo.', actuacion:'Se localiza, interviene conforme a protocolo y se restituye el servicio.', comprob:'Verificación de presión, estanqueidad y funcionamiento.', recom:'Notificar a supervisión y registrar en sistema de gases.', riesgo:'Interrupción de suministro de gas medicinal a pacientes.' },
  electrica: { elem:'Cuadro eléctrico / instalación eléctrica', causas:'Fallo de protección, disparo de diferencial o cortocircuito.', actuacion:'Se identifica el origen, se corrige la causa y se restablece el servicio.', comprob:'Verificación de tensiones, protecciones y continuidad del servicio.', recom:'Revisar cargas del circuito afectado.', riesgo:'Riesgo eléctrico. Parada de servicio dependiente.' },
};
function applyTemplate(tipo) {
  const p = TEMPLATES[tipo]; if (!p) return;
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  s('f-elem', p.elem); s('f-causas', p.causas); s('f-actuacion', p.actuacion);
  s('f-comprob', p.comprob); s('f-recom', p.recom); s('f-riesgo', p.riesgo);
  scheduleDraft();
  toast('Plantilla cargada.');
}

/* ══════════════════════════════════════════════════════════
   9. CHECKLIST
══════════════════════════════════════════════════════════ */
const CHECKLISTS = {
  Electricidad:      ['Verificar protecciones, magnetotérmicos y diferenciales.','Comprobar tensión / funcionamiento tras la intervención.','Revisar conexiones flojas, calentamientos y etiquetado.','Tomar foto del cuadro o equipo intervenido.'],
  Fontanería:        ['Comprobar ausencia de fugas tras la reparación.','Verificar presión, cierre y estanqueidad del punto reparado.','Revisar juntas, sifones, llaves y desagüe.','Tomar foto del punto reparado.'],
  Climatización:     ['Comprobar arranque/parada y parámetros básicos.','Revisar filtros, drenajes y limpieza general.','Verificar temperatura o caudal básico.','Tomar foto del equipo y referencia.'],
  Cerrajería:        ['Comprobar cierre, apertura y alineación.','Verificar funcionamiento desde los puntos de uso.','Revisar desgaste mecánico y fijaciones.','Tomar foto del conjunto intervenido.'],
  'Obra civil':      ['Verificar remate, nivelación y seguridad de la zona.','Comprobar limpieza y retirada de material sobrante.','Revisar fijaciones, sellados o acabado.','Tomar foto del antes/después.'],
  'Gases medicinales':['Verificar cierre y estanqueidad del punto intervenido.','Comprobar presión y funcionamiento del ramal.','Revisar etiquetado y señalización.','Tomar foto del punto reparado.'],
};
function loadChecklistBySpecialty() {
  const esp   = document.getElementById('f-esp')?.value || 'Electricidad';
  const items = CHECKLISTS[esp] || CHECKLISTS.Electricidad;
  const list  = document.getElementById('chk-list');
  if (!list) return;
  list.innerHTML = items.map((txt, i) => `
    <label class="chk-item">
      <input type="checkbox" data-i="${i}">
      <div><strong>${esc(esp)}</strong><br>${esc(txt)}</div>
    </label>`).join('');
}
function clearChecklist() { const l = document.getElementById('chk-list'); if (l) l.innerHTML = ''; }
function checklistSummary() {
  const ch  = document.querySelectorAll('#chk-list input:checked').length;
  const tot = document.querySelectorAll('#chk-list input').length;
  return `${ch}/${tot} checks completados`;
}

/* ══════════════════════════════════════════════════════════
   10. RECOGER DATOS DEL FORMULARIO
══════════════════════════════════════════════════════════ */
function collectForm() {
  const g = id => document.getElementById(id)?.value || '';
  const tipo = document.querySelector('.tipo-card.active')?.dataset?.tipo || 'averia';
  return {
    tipo,
    ot:       g('f-ot')    || 'Sin OT',
    fecha:    g('f-fecha'),
    zona:     g('f-zona')  || 'Pendiente',
    tec:      g('f-tecnico') || 'Pendiente',
    esp:      g('f-esp')   || 'General',
    elem:     g('f-elem')  || 'Pendiente',
    desc:     g('f-desc'),
    mat:      g('f-mat')   || 'Sin especificar',
    estado:   g('f-estado'),
    instalacionId: g('f-instalacion'),
    otestado: g('f-otestado'),
    planfecha:g('f-planfecha'),
    freq:     g('f-freq'),
    recordatorio: g('f-recordatorio'),
    prioridad:(g('f-prioridad') || 'MEDIA').toUpperCase(),
    resumen:  g('f-resumen'),
    causas:   g('f-causas'),
    actuacion:g('f-actuacion'),
    comprob:  g('f-comprob'),
    recom:    g('f-recom'),
    riesgo:   g('f-riesgo'),
    checklist: checklistSummary(),
  };
}

function restoreForm(data) {
  if (!data) return;
  const s = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  const tipCard = document.querySelector(`.tipo-card[data-tipo="${data.tipo || 'averia'}"]`);
  if (tipCard) setTipo(tipCard);
  ['ot','fecha','zona','tec:tecnico','esp','elem','desc','mat','estado',
   'prioridad','resumen','causas','actuacion','comprob:comprob','recom','riesgo',
   'otestado','planfecha','freq','recordatorio'
  ].forEach(pair => {
    const [field, formId] = pair.includes(':') ? pair.split(':') : [pair, pair];
    s(`f-${formId}`, data[field]);
  });
  s('f-tecnico', data.tec);
  updatePrioIndicator();
  loadChecklistBySpecialty();
  App.fotos = []; renderFotos();
}

/* ══════════════════════════════════════════════════════════
   11. BORRADOR AUTOSAVE
══════════════════════════════════════════════════════════ */
function scheduleDraft() {
  clearTimeout(App.draftTimer);
  App.draftTimer = setTimeout(() => {
    try { localStorage.setItem('ivp_draft', JSON.stringify(collectForm())); } catch {}
  }, 700);
}
function clearDraft()   { try { localStorage.removeItem('ivp_draft'); } catch {} }
function initDraft() {
  try {
    const raw = localStorage.getItem('ivp_draft');
    if (raw) {
      const d = JSON.parse(raw);
      if (d?.ot || d?.desc || d?.zona) { restoreForm(d); toast('Borrador restaurado.'); }
    }
  } catch {}
  const ids = ['f-ot','f-fecha','f-zona','f-tecnico','f-esp','f-elem','f-desc','f-mat',
    'f-estado','f-prioridad','f-resumen','f-causas','f-actuacion','f-comprob',
    'f-recom','f-riesgo','f-otestado','f-planfecha','f-freq','f-recordatorio'];
  ids.forEach(id => {
    document.getElementById(id)?.addEventListener('input',  scheduleDraft);
    document.getElementById(id)?.addEventListener('change', scheduleDraft);
  });
}

/* ══════════════════════════════════════════════════════════
   12. GENERAR INFORME + PDF
══════════════════════════════════════════════════════════ */
async function generar() {
  const data = collectForm();
  if (!data.zona || data.zona === 'Pendiente') { showErr('Indica la zona / servicio afectado.'); return; }

  setUI({ gen: false, prog: true, res: false, err: false });
  setProgBar(10);

  try {
    step('ps1', 'active'); await sleep(180); step('ps1', 'done'); setProgBar(30);
    step('ps2', 'active');
    const fotoB64 = App.fotos.map(f => f.b64);
    await sleep(100); step('ps2', 'done'); setProgBar(55);
    step('ps3', 'active'); await sleep(120); step('ps3', 'done'); setProgBar(70);
    step('ps4', 'active');
    const blob = await buildPDF(data, fotoB64);
    step('ps4', 'done'); setProgBar(85);
    step('ps5', 'active');
    const fname = `IVP-${data.ot.replace(/\//g,'-')}-${data.fecha || 'sin-fecha'}.pdf`;
    App.lastPdfUrl  = URL.createObjectURL(blob);
    App.lastPdfName = fname;
    document.getElementById('btn-dl').onclick = () => dlFile(App.lastPdfUrl, fname);
    document.getElementById('res-fname').textContent = fname;

    // Guardar en DB
    const record = { ...data, fname, id: `${Date.now()}` };
    await DB.save('informes', record);

    step('ps5', 'done'); setProgBar(100);
    await sleep(350);
    setUI({ gen: true, prog: false, res: true, err: false });
    renderHome(); renderHistorial(); updateOTBadge();
    clearDraft();
    toast('Informe generado con éxito.');
  } catch (err) {
    showErr('Error al generar el PDF: ' + err.message);
    setUI({ gen: true, prog: false, res: false, err: true });
  }
}

function setUI({ gen, prog, res, err }) {
  const toggle = (id, cls, show) => document.getElementById(id)?.classList.toggle(cls, !!show);
  const el = document.getElementById('btn-gen');
  if (el) el.disabled = !gen;
  toggle('prog-card', 'show', prog);
  toggle('res-card',  'show', res);
  toggle('err-card',  'show', err);
}
function setProgBar(pct) { const b = document.getElementById('prog-bar'); if (b) b.style.width = pct + '%'; }
function step(id, state) {
  const el = document.getElementById(id); if (!el) return;
  el.className = 'prog-step ' + state;
  const ico = el.querySelector('.prog-ico');
  if (!ico) return;
  if (state === 'active') ico.innerHTML = '<div class="spin"></div>';
  if (state === 'done')   ico.textContent = '✅';
}
function showErr(msg) {
  const e = document.getElementById('err-card');
  if (e) { e.textContent = msg; e.classList.add('show'); }
  document.getElementById('btn-gen').disabled = false;
}

/* ── PDF ENGINE ─────────────────────────────────────────── */
async function buildPDF(d, fotoB64 = []) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, mg = 14, cw = W - mg * 2;
  let y = 0;

  const PCOL = { URGENTE:[220,38,38], ALTA:[217,119,6], MEDIA:[37,99,235], BAJA:[107,114,128] };
  const pc = PCOL[(d.prioridad||'MEDIA').toUpperCase()] || PCOL.MEDIA;

  // ── Cabecera azul ──
  doc.setFillColor(26, 95, 212);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('HOSPITAL UNIVERSITARIO CLÍNICO SAN CECILIO', mg, 11);
  doc.setFontSize(10);
  doc.text('Servicio de Mantenimiento · Parte de Intervención Técnica', mg, 18);
  doc.setFontSize(8.5);
  doc.text(`OT: ${d.ot}   ·   Fecha: ${d.fecha || '—'}   ·   ${d.tipo === 'preventivo' ? 'PREVENTIVO' : 'CORRECTIVO'}`, mg, 24.5);

  // ── Banda prioridad ──
  doc.setFillColor(...pc);
  doc.rect(0, 28, W, 6, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(`▌ PRIORIDAD: ${d.prioridad}   ·   ESTADO: ${(d.estado||'').toUpperCase()}   ·   TÉCNICO: ${d.tec}`, mg, 32.5);
  doc.setTextColor(20, 20, 20);
  y = 40;

  const checkPage = () => { if (y > H - 28) { doc.addPage(); y = 16; } };
  const section = (title) => {
    checkPage();
    doc.setFillColor(237, 242, 252);
    doc.rect(mg, y, cw, 7, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.setTextColor(...pc);
    doc.text(title.toUpperCase(), mg + 3, y + 5);
    doc.setTextColor(20,20,20);
    y += 10;
  };
  const row = (label, value) => {
    if (!value || value === 'Sin especificar') return;
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text(label + ':', mg, y);
    doc.setFont('helvetica','normal');
    const lines = doc.splitTextToSize(String(value), cw - 38);
    doc.text(lines, mg + 36, y);
    y += lines.length * 5 + 2; checkPage();
  };
  const block = (label, value) => {
    if (!value) return;
    if (label) { doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.text(label + ':', mg, y); y += 5; }
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(String(value), cw);
    doc.text(lines, mg, y);
    y += lines.length * 5 + 3; checkPage();
  };

  section('Datos de la intervención');
  row('Zona / Servicio', d.zona); row('Técnico', d.tec);
  row('Especialidad', d.esp); row('Elemento / Equipo', d.elem);
  if (d.mat && d.mat !== 'Sin especificar') row('Material', d.mat);

  if (d.desc)     { section('Descripción de la incidencia'); block('', d.desc); }
  if (d.causas)   { section('Causas / Motivo'); block('', d.causas); }
  if (d.actuacion){ section('Actuación ejecutada'); block('', d.actuacion); }
  if (d.comprob)  { section('Comprobaciones realizadas'); block('', d.comprob); }
  if (d.recom)    { section('Observaciones y recomendaciones'); block('', d.recom); }
  if (d.riesgo)   { section('Riesgo asociado'); block('', d.riesgo); }
  if (d.checklist){ section('Checklist de calidad'); block('', d.checklist); }

  // ── Fotos ──
  if (fotoB64.length) {
    checkPage();
    section(`Registro fotográfico — ${fotoB64.length} imagen${fotoB64.length > 1 ? 'es' : ''}`);
    const cols = fotoB64.length >= 2 ? 2 : 1;
    const fw   = (cw - (cols - 1) * 4) / cols;
    const fh   = 52;
    for (let i = 0; i < fotoB64.length; i++) {
      const col = i % cols;
      if (col === 0 && i > 0) { y += fh + 4; checkPage(); }
      const fx = mg + col * (fw + 4);
      try { doc.addImage(fotoB64[i], 'JPEG', fx, y, fw, fh, '', 'MEDIUM'); } catch {}
      if (i === fotoB64.length - 1) y += fh + 4;
    }
  }

  // ── Pie de página ──
  y = Math.max(y + 4, H - 22);
  doc.setFillColor(240, 244, 252);
  doc.rect(0, y, W, H - y, 'F');
  doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(100,120,150);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}   ·   IsiVoltPro v1.0   ·   HUCSC Servicio de Mantenimiento`, mg, y + 7);
  doc.text('Firma técnico: _______________________         Firma responsable: _______________________', mg, y + 14);

  return doc.output('blob');
}

/* ══════════════════════════════════════════════════════════
   13. HISTORIAL
══════════════════════════════════════════════════════════ */
function renderHistorial() {
  const box = document.getElementById('hist-list');
  if (!box) return;
  const q = (document.getElementById('hist-search')?.value || '').toLowerCase();
  let items = DB.getAll('informes');
  if (q) items = items.filter(h => [h.ot, h.zona, h.tec, h.esp, h.elem, h.desc].some(v => (v||'').toLowerCase().includes(q)));

  const nt = document.getElementById('st-total');
  const na = document.getElementById('st-av');
  const np = document.getElementById('st-prev');
  const all = DB.getAll('informes');
  if (nt) nt.textContent = all.length;
  if (na) na.textContent = all.filter(h => h.tipo === 'averia').length;
  if (np) np.textContent = all.filter(h => h.tipo === 'preventivo').length;

  if (!items.length) {
    box.innerHTML = `<div class="empty"><div class="empty-ico">📁</div><p>${q ? 'Sin resultados para esa búsqueda.' : 'No hay informes todavía.<br>Genera el primero desde la sección Informes.'}</p></div>`;
    return;
  }
  box.innerHTML = items.map(h => {
    const pr  = (h.prioridad || 'MEDIA').toUpperCase();
    const est = h.estado || 'resuelta';
    return `
    <div class="list-card prio-${pr}">
      <div class="lc-top">
        <div class="lc-ico ${h.tipo === 'preventivo' ? 'pm' : 'av'}">${h.tipo === 'preventivo' ? '🔍' : '🔧'}</div>
        <div class="lc-info">
          <div class="lc-ot">${esc(h.ot || 'Sin OT')}</div>
          <div class="lc-title">${esc(h.zona || 'Sin zona')} — ${esc(h.elem || '')}</div>
          <div class="lc-meta">${esc(h.fecha || '')} · ${esc(h.tec || 'Sin técnico')} · ${esc(h.esp || '')}</div>
          <div class="lc-pills">
            <span class="badge p-${pr}">${pr}</span>
            <span class="badge e-${est}">${estLabel(est)}</span>
          </div>
        </div>
      </div>
      <div class="lc-actions">
        <button class="lc-btn edit" onclick="editInforme('${h.id}')">✏️ Editar</button>
        <button class="lc-btn dl"   onclick="regenPDF('${h.id}')">⬇ PDF</button>
        <button class="lc-btn del"  onclick="deleteInforme('${h.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

async function deleteInforme(id) {
  const h = DB.getById('informes', id);
  if (!h) return;
  if (!confirm(`¿Eliminar el informe ${h.ot || 'Sin OT'}?`)) return;
  await DB.remove('informes', id);
  renderHistorial(); renderHome(); toast('Informe eliminado.');
}
function editInforme(id) {
  const h = DB.getById('informes', id);
  if (!h) return;
  restoreForm(h);
  goPage('informes');
  toast('Informe cargado para editar.');
}
async function regenPDF(id) {
  const h = DB.getById('informes', id);
  if (!h) return;
  toast('Regenerando PDF…');
  try {
    const blob = await buildPDF(h, []);
    dlFile(URL.createObjectURL(blob), h.fname || `IVP-${h.ot}.pdf`);
  } catch(e) { toast('Error: ' + e.message); }
}
async function clearHistorial() {
  if (!confirm('¿Vaciar todo el historial? Esta acción no se puede deshacer.')) return;
  const items = DB.getAll('informes');
  await Promise.all(items.map(i => DB.remove('informes', i.id)));
  renderHistorial(); renderHome(); toast('Historial vaciado.');
}

function estLabel(est) {
  return { resuelta:'✅ Resuelta', pendiente:'⏳ Pendiente', observacion:'👁 Obs.', derivada:'↗ Derivada' }[est] || est;
}
function otEstLabel(est) {
  return { Borrador:'Borrador', Planificada:'Planificada', 'En curso':'En curso', 'Pendiente material':'Pend. material', Cerrada:'Cerrada' }[est] || est;
}
function otEstClass(est) {
  return 'ot-' + (est||'Borrador').replace(/ /g,'-');
}

/* ══════════════════════════════════════════════════════════
   14. OT / CALENDARIO
══════════════════════════════════════════════════════════ */
function renderCalGrid() {
  const grid  = document.getElementById('cal-grid');
  const title = document.getElementById('cal-title');
  if (!grid) return;
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  title.textContent = `${MONTHS[App.calMonth]} ${App.calYear}`;

  // Mantener headers DOW
  const heads = [...grid.querySelectorAll('.cal-dow')];
  grid.innerHTML = ''; heads.forEach(h => grid.appendChild(h));

  const firstDay  = new Date(App.calYear, App.calMonth, 1).getDay();
  const offset    = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMon = new Date(App.calYear, App.calMonth + 1, 0).getDate();
  const today = new Date();
  const todayKey = fmtDate(today);

  // Mapa día → OTs
  const ots = DB.getAll('ots');
  const dayMap = {};
  const mesStr = `${App.calYear}-${String(App.calMonth+1).padStart(2,'0')}`;
  ots.forEach(o => {
    const d = o.fecha || o.planfecha || '';
    if (!d.startsWith(mesStr)) return;
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(o);
  });

  for (let i = 0; i < offset; i++) {
    const c = document.createElement('div');
    c.className = 'cal-cell other'; c.textContent = '';
    grid.appendChild(c);
  }
  for (let d = 1; d <= daysInMon; d++) {
    const key   = `${mesStr}-${String(d).padStart(2,'0')}`;
    const tasks = dayMap[key] || [];
    const cell  = document.createElement('div');
    cell.className = 'cal-cell' + (tasks.length ? ' has-task clickable' : '') + (key === todayKey ? ' today' : '');
    cell.textContent = d;
    if (tasks.length) {
      const dots = document.createElement('div');
      dots.className = 'cal-dots';
      tasks.slice(0, 3).forEach(t => {
        const p = document.createElement('div');
        const pr = (t.prioridad||'MEDIA').toUpperCase();
        p.className = 'pip ' + (t.estado==='Cerrada'?'ok':pr==='URGENTE'?'u':pr==='ALTA'?'a':pr==='BAJA'?'b':'m');
        dots.appendChild(p);
      });
      cell.appendChild(dots);
      cell.onclick = () => showDayTasks(key, tasks);
    }
    grid.appendChild(cell);
  }

  // KPIs
  const enMes = ots.filter(o => (o.fecha||o.planfecha||'').startsWith(mesStr));
  document.getElementById('ot-total').textContent   = ots.length;
  document.getElementById('ot-open').textContent    = ots.filter(o => o.estado !== 'Cerrada').length;
  document.getElementById('ot-pm').textContent      = ots.filter(o => o.tipo === 'PM').length;
  document.getElementById('ot-mes').textContent     = enMes.length;
}

function changeMonth(dir) {
  App.calMonth += dir;
  if (App.calMonth > 11) { App.calMonth = 0; App.calYear++; }
  if (App.calMonth < 0)  { App.calMonth = 11; App.calYear--; }
  renderCalGrid(); renderOTList();
}

function showDayTasks(dateKey, tasks) {
  const [y, m, d] = dateKey.split('-');
  const label = `${d}/${m}/${y}`;
  alert(`Tareas del ${label}:\n\n${tasks.map(t => `• [${t.estado||'—'}] ${t.title||'OT'} — ${t.zona||''}`).join('\n')}`);
}

function renderOTList() {
  const box   = document.getElementById('ot-list');
  if (!box) return;
  const fEst  = document.getElementById('ot-filter-est')?.value || '';
  const fTipo = document.getElementById('ot-filter-tipo')?.value || '';
  const fMes  = document.getElementById('ot-filter-mes')?.value || '';
  let items = DB.getAll('ots');
  if (fEst)  items = items.filter(o => o.estado === fEst);
  if (fTipo) items = items.filter(o => o.tipo === fTipo);
  if (fMes)  items = items.filter(o => (o.fecha||o.planfecha||'').startsWith(fMes));
  const prioOrd = { URGENTE:0, ALTA:1, MEDIA:2, BAJA:3 };
  items.sort((a,b) => {
    const pa = prioOrd[(a.prioridad||'MEDIA').toUpperCase()] ?? 2;
    const pb = prioOrd[(b.prioridad||'MEDIA').toUpperCase()] ?? 2;
    return pa - pb || (a.fecha||'').localeCompare(b.fecha||'');
  });
  if (!items.length) {
    box.innerHTML = `<div class="empty"><div class="empty-ico">🛠️</div><p>No hay OTs con ese filtro.<br>Guarda una desde el formulario de Informes.</p></div>`;
    return;
  }
  box.innerHTML = items.map(o => {
    const pr  = (o.prioridad || 'MEDIA').toUpperCase();
    const est = o.estado || 'Borrador';
    return `
    <div class="list-card prio-${pr}">
      <div class="lc-top">
        <div class="lc-ico ${o.tipo==='PM'?'pm':'ot'}">${o.tipo==='PM'?'🔍':'🛠️'}</div>
        <div class="lc-info">
          <div class="lc-title">${esc(o.title || 'OT sin título')}</div>
          <div class="lc-meta">${esc(o.fecha||'Sin fecha')} · ${esc(o.zona||'Sin zona')} · ${esc(o.especialidad||'General')}</div>
          <div class="lc-pills">
            <span class="badge p-${pr}">${pr}</span>
            <span class="badge ${otEstClass(est)}">${otEstLabel(est)}</span>
            ${o.frecuencia ? `<span class="badge" style="background:var(--acc-s);color:var(--acc);border:1px solid var(--acc)">🔄 ${esc(o.frecuencia)}</span>` : ''}
          </div>
          ${o.nota ? `<div style="font-size:10px;color:var(--t2);margin-top:5px">📌 ${esc(o.nota)}</div>` : ''}
        </div>
      </div>
      <div class="lc-actions">
        <button class="lc-btn edit"  onclick="loadOT('${o.id}')">↩ Cargar</button>
        <button class="lc-btn dl"    onclick="closeOT('${o.id}')">✅ Cerrar</button>
        <button class="lc-btn del"   onclick="deleteOT('${o.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

async function saveOTFromForm() {
  const fecha = document.getElementById('f-planfecha')?.value;
  if (!fecha) { toast('Indica una fecha planificada.'); return; }
  const data = collectForm();
  const pr   = data.prioridad || 'MEDIA';
  const ot = {
    id:          `${Date.now()}`,
    title:       data.elem || data.zona || 'Trabajo planificado',
    zona:        data.zona,
    especialidad:data.esp,
    estado:      data.otestado || 'Planificada',
    fecha,
    prioridad:   pr,
    frecuencia:  data.freq,
    nota:        data.recordatorio,
    tipo:        data.freq ? 'PM' : 'OT',
  };
  await DB.save('ots', ot);
  renderOTList(); renderCalGrid(); renderHome(); updateOTBadge();
  toast('OT guardada en calendario.');
}
function loadOT(id) {
  const o = DB.getById('ots', id);
  if (!o) return;
  const s = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v||''; };
  s('f-elem', o.title); s('f-zona', o.zona); s('f-esp', o.especialidad);
  s('f-planfecha', o.fecha); s('f-freq', o.frecuencia);
  s('f-otestado', o.estado); s('f-recordatorio', o.nota);
  loadChecklistBySpecialty();
  goPage('informes'); toast('OT cargada en el formulario.');
}
async function closeOT(id) {
  await DB.patch('ots', id, { estado: 'Cerrada' });
  renderOTList(); renderCalGrid(); updateOTBadge(); toast('OT cerrada.');
}
async function deleteOT(id) {
  if (!confirm('¿Eliminar esta OT?')) return;
  await DB.remove('ots', id);
  renderOTList(); renderCalGrid(); updateOTBadge(); toast('OT eliminada.');
}
function updateOTBadge() {
  const ots  = DB.getAll('ots');
  const open = ots.filter(o => o.estado !== 'Cerrada').length;
  const urg  = ots.filter(o => (o.prioridad||'').toUpperCase()==='URGENTE' && o.estado!=='Cerrada').length;
  let badge  = document.getElementById('ot-badge');
  const btn  = document.getElementById('nb-ot');
  if (!btn) return;
  if (open > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'nav-badge'; badge.id = 'ot-badge'; btn.appendChild(badge); }
    badge.textContent    = open;
    badge.style.background = urg ? 'var(--pu)' : 'var(--pa)';
  } else { badge?.remove(); }
}

/* ══════════════════════════════════════════════════════════
   15. INSTALACIONES
══════════════════════════════════════════════════════════ */
async function saveInstallation() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  if (!g('inst-nombre')) { toast('Escribe el nombre de la instalación.'); return; }
  const payload = {
    id:            App.editingInstId || `${Date.now()}`,
    nombre:        g('inst-nombre'),
    codigo:        g('inst-codigo'),
    direccion:     g('inst-direccion'),
    zona:          g('inst-zona'),
    tecnico:       g('inst-tecnico'),
    especialidad:  g('inst-especialidad'),
    elemento:      g('inst-elemento'),
    potencia:      g('inst-potencia'),
    tension:       g('inst-tension'),
    datosTec:      g('inst-tecnicos'),
    observaciones: g('inst-observaciones'),
    foto:          App.instPhotoB64 || '',
  };
  await DB.save('instalaciones', payload);
  App.editingInstId = payload.id;
  populateInstSelect(payload.id);
  renderInstalaciones();
  toast('Instalación guardada.');
}
function clearInstForm() {
  App.editingInstId = ''; App.instPhotoB64 = '';
  ['inst-nombre','inst-codigo','inst-direccion','inst-zona','inst-tecnico',
   'inst-elemento','inst-potencia','inst-tension','inst-tecnicos','inst-observaciones']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const esp = document.getElementById('inst-especialidad'); if (esp) esp.value = '';
  setPhotoPreview(''); toast('Formulario limpio.');
}
function editInstallation(id) {
  const inst = DB.getById('instalaciones', id);
  if (!inst) return;
  App.editingInstId = id; App.instPhotoB64 = inst.foto || '';
  const s = (eid, v) => { const el = document.getElementById(eid); if (el) el.value = v||''; };
  s('inst-nombre', inst.nombre); s('inst-codigo', inst.codigo);
  s('inst-direccion', inst.direccion); s('inst-zona', inst.zona);
  s('inst-tecnico', inst.tecnico); s('inst-especialidad', inst.especialidad);
  s('inst-elemento', inst.elemento); s('inst-potencia', inst.potencia);
  s('inst-tension', inst.tension); s('inst-tecnicos', inst.datosTec);
  s('inst-observaciones', inst.observaciones);
  setPhotoPreview(inst.foto || '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('Ficha cargada.');
}
async function deleteInstallation(id) {
  const inst = DB.getById('instalaciones', id);
  if (!inst) return;
  if (!confirm(`¿Eliminar la instalación "${inst.nombre}"?`)) return;
  await DB.remove('instalaciones', id);
  if (App.editingInstId === id) clearInstForm();
  populateInstSelect(); renderInstalaciones(); toast('Instalación eliminada.');
}
function useInstallation(id) {
  const inst = DB.getById('instalaciones', id);
  if (!inst) return;
  const s = (eid, v) => { const el = document.getElementById(eid); if (el && v) el.value = v; };
  s('f-zona', inst.zona || inst.nombre);
  s('f-tecnico', inst.tecnico); s('f-esp', inst.especialidad);
  if (!document.getElementById('f-elem')?.value) s('f-elem', inst.elemento);
  document.getElementById('f-instalacion').value = id;
  scheduleDraft();
  goPage('informes'); toast('Instalación cargada.');
}
function populateInstSelect(selId = '') {
  const sel = document.getElementById('f-instalacion');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sin seleccionar —</option>';
  DB.getAll('instalaciones').forEach(inst => {
    const o = document.createElement('option');
    o.value = inst.id;
    o.textContent = `${inst.nombre}${inst.especialidad ? ' · ' + inst.especialidad : ''}`;
    if (inst.id === selId) o.selected = true;
    sel.appendChild(o);
  });
}
function loadInstFromSelect() {
  const sel = document.getElementById('f-instalacion');
  if (!sel?.value) return;
  const inst = DB.getById('instalaciones', sel.value);
  if (!inst) return;
  const s = (eid, v) => { const el = document.getElementById(eid); if (el && v) el.value = v; };
  s('f-zona', inst.zona || inst.nombre); s('f-tecnico', inst.tecnico);
  s('f-esp', inst.especialidad);
  if (!document.getElementById('f-elem')?.value) s('f-elem', inst.elemento);
  scheduleDraft(); toast('Instalación cargada.');
}
function renderInstalaciones() {
  const box = document.getElementById('inst-list');
  if (!box) return;
  const items = DB.getAll('instalaciones');
  if (!items.length) {
    box.innerHTML = `<div class="empty"><div class="empty-ico">🏷️</div><p>No hay instalaciones todavía.<br>Crea la primera ficha arriba.</p></div>`;
    return;
  }
  box.innerHTML = items.map(inst => `
    <div class="inst-card">
      <div class="inst-top">
        <div class="inst-thumb">${inst.foto ? `<img src="${inst.foto}" alt="${esc(inst.nombre||'')}">` : '🏷️'}</div>
        <div style="flex:1;min-width:0">
          <div class="inst-name">${esc(inst.nombre || 'Instalación')}</div>
          <div class="inst-meta">${esc(inst.direccion || inst.zona || 'Sin ubicación')}<br>${esc(inst.tecnico || 'Sin técnico')} · ${esc(inst.especialidad || 'General')}</div>
          <div class="inst-tags">
            ${inst.codigo   ? `<span class="inst-tag"># ${esc(inst.codigo)}</span>`   : ''}
            ${inst.elemento ? `<span class="inst-tag">${esc(inst.elemento)}</span>`   : ''}
            ${inst.potencia ? `<span class="inst-tag">${esc(inst.potencia)}</span>`   : ''}
            ${inst.tension  ? `<span class="inst-tag">${esc(inst.tension)}</span>`    : ''}
          </div>
        </div>
      </div>
      <div class="btn-bar" style="margin-top:10px">
        <button class="btn-ghost sm acc" onclick="useInstallation('${inst.id}')">↩ Usar</button>
        <button class="btn-ghost sm"     onclick="editInstallation('${inst.id}')">✏️ Editar</button>
        <button class="btn-ghost sm"     onclick="openMap('${inst.id}')">🗺️ Mapa</button>
        <button class="btn-ghost sm red" onclick="deleteInstallation('${inst.id}')">🗑</button>
      </div>
    </div>`).join('');
}
function openMap(id = '') {
  const inst = id ? DB.getById('instalaciones', id) : { direccion: document.getElementById('inst-direccion')?.value };
  const q = encodeURIComponent(inst?.direccion || inst?.zona || inst?.nombre || '');
  if (!q) { toast('Añade una dirección primero.'); return; }
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
}

/* Foto instalación */
async function handleInstPhoto(e) {
  const file = e.target.files?.[0]; if (!file) return;
  try { App.instPhotoB64 = await compressImage(file, 1100, .75); setPhotoPreview(App.instPhotoB64); toast('Foto cargada.'); }
  catch { toast('No se pudo cargar la foto.'); }
  finally { e.target.value = ''; }
}
function removeInstPhoto() { App.instPhotoB64 = ''; setPhotoPreview(''); }
function setPhotoPreview(src = '') {
  const img = document.getElementById('inst-photo-prev');
  const emp = document.getElementById('inst-photo-empty');
  if (!img || !emp) return;
  if (src) { img.src = src; img.style.display = 'block'; emp.style.display = 'none'; }
  else { img.removeAttribute('src'); img.style.display = 'none'; emp.style.display = 'flex'; }
}

/* ══════════════════════════════════════════════════════════
   16. ESTADÍSTICAS
══════════════════════════════════════════════════════════ */
function renderStats() {
  const kpis  = document.getElementById('stats-kpis');
  const bPrio = document.getElementById('stats-prioridades');
  const bEsp  = document.getElementById('stats-especialidades');
  const bEst  = document.getElementById('stats-estados');
  if (!kpis) return;

  const informes = DB.getAll('informes');
  const ots      = DB.getAll('ots');
  const all      = [...informes, ...ots];

  const resueltas = informes.filter(x=>x.estado==='resuelta').length + ots.filter(x=>x.estado==='Cerrada').length;
  const urgentes  = all.filter(x=>(x.prioridad||'').toUpperCase()==='URGENTE').length;

  kpis.innerHTML = `
    <div class="kpi-card"><div class="kpi-n">${informes.length}</div><div class="kpi-l">Informes</div></div>
    <div class="kpi-card"><div class="kpi-n">${ots.length}</div><div class="kpi-l">OTs</div></div>
    <div class="kpi-card ok"><div class="kpi-n">${resueltas}</div><div class="kpi-l">Resueltas</div></div>
    <div class="kpi-card danger"><div class="kpi-n">${urgentes}</div><div class="kpi-l">Urgentes</div></div>`;

  const countMap = (arr, fn) => arr.reduce((a,it) => { const k = fn(it)||'Sin dato'; a[k]=(a[k]||0)+1; return a; }, {});
  const bars = (target, obj) => {
    if (!target) return;
    const entries = Object.entries(obj).sort((a,b) => b[1]-a[1]);
    if (!entries.length) { target.innerHTML='<div style="color:var(--t3);font-size:12px">Sin datos todavía.</div>'; return; }
    const max = entries[0][1] || 1;
    target.innerHTML = entries.map(([k,v]) => `
      <div class="bar-item">
        <div class="bar-label">${esc(k)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(5,(v/max)*100)}%"></div></div>
        <div class="bar-val">${v}</div>
      </div>`).join('');
  };
  bars(bPrio, countMap(all, x => (x.prioridad||'MEDIA').toUpperCase()));
  bars(bEsp,  countMap(all, x => (x.esp||x.especialidad||'General')));
  bars(bEst,  countMap(all, x => (x.estado||'Sin estado')));
}

/* ══════════════════════════════════════════════════════════
   17. HOME / INICIO
══════════════════════════════════════════════════════════ */
function renderHome() {
  const informes = DB.getAll('informes');
  const ots      = DB.getAll('ots');
  const insts    = DB.getAll('instalaciones');

  const total = informes.length + ots.length;
  const open  = informes.filter(x=>x.estado!=='resuelta').length + ots.filter(x=>x.estado!=='Cerrada').length;
  const urg   = [...informes,...ots].filter(x=>(x.prioridad||'').toUpperCase()==='URGENTE'&&x.estado!=='resuelta'&&x.estado!=='Cerrada').length;

  setValue('kpi-total', total);
  setValue('kpi-open',  open);
  setValue('kpi-urg',   urg);
  setValue('kpi-inst',  insts.length);

  // Próximas OTs
  const upBox = document.getElementById('home-upcoming');
  if (upBox) {
    const tasks = [...ots].filter(o=>o.estado!=='Cerrada').sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')).slice(0,4);
    upBox.innerHTML = tasks.length ? tasks.map(t => `
      <div class="mini-item">
        <b>${esc(t.title||'OT')} <span class="badge p-${(t.prioridad||'MEDIA').toUpperCase()}">${(t.prioridad||'MEDIA').toUpperCase()}</span></b>
        <span>${esc(t.fecha||'Sin fecha')} · ${esc(t.zona||'Sin zona')} · <span class="badge ${otEstClass(t.estado||'Borrador')}">${otEstLabel(t.estado||'Borrador')}</span></span>
      </div>`).join('')
    : '<div class="mini-item"><b>Sin tareas próximas</b><span>Crea OTs desde el formulario de Informes.</span></div>';
  }

  // Últimos informes
  const recBox = document.getElementById('home-recent');
  if (recBox) {
    const recent = informes.slice(0, 4);
    recBox.innerHTML = recent.length ? recent.map(h => `
      <div class="mini-item">
        <b>${esc(h.ot||'Sin OT')} — ${esc(h.zona||'Sin zona')} <span class="badge p-${(h.prioridad||'MEDIA').toUpperCase()}">${(h.prioridad||'MEDIA').toUpperCase()}</span></b>
        <span>${esc(h.fecha||'')} · ${esc(h.esp||'General')} · <span class="badge e-${h.estado||'resuelta'}">${estLabel(h.estado||'resuelta')}</span></span>
      </div>`).join('')
    : '<div class="mini-item"><b>Sin registros recientes</b><span>Los informes generados aparecerán aquí.</span></div>';
  }
  updateOTBadge();
}

/* ══════════════════════════════════════════════════════════
   18. LIMPIAR FORMULARIO
══════════════════════════════════════════════════════════ */
function limpiarForm() {
  setUI({ gen: true, prog: false, res: false, err: false });
  ['f-ot','f-desc','f-mat','f-elem','f-zona','f-tecnico',
   'f-resumen','f-causas','f-actuacion','f-comprob','f-recom','f-riesgo',
   'f-planfecha','f-freq','f-recordatorio'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  setValue('f-prioridad', 'MEDIA'); setValue('f-estado', 'resuelta');
  setValue('f-otestado', 'Borrador');
  initDate(); updatePrioIndicator();
  clearChecklist(); loadChecklistBySpecialty();
  clearDraft();
  App.fotos = []; renderFotos();
  window.scrollTo(0, 0);
  toast('Formulario limpiado.');
}

/* ══════════════════════════════════════════════════════════
   19. BACKUP
══════════════════════════════════════════════════════════ */
function exportBackup() {
  try {
    const payload = DB.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    dlFile(URL.createObjectURL(blob), `isivoltpro-backup-${new Date().toISOString().slice(0,10)}.json`);
    toast('Copia exportada.');
  } catch { toast('Error al exportar.'); }
}
async function importBackup(e) {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const txt  = await file.text();
    const data = JSON.parse(txt);
    await DB.importBackup(data);
    populateInstSelect(); renderAll();
    toast('Copia importada correctamente.');
  } catch (err) { toast('Error al importar: ' + err.message); }
  finally { e.target.value = ''; }
}

/* ══════════════════════════════════════════════════════════
   20. CONFIGURACIÓN GITHUB
══════════════════════════════════════════════════════════ */
function saveGitHubConfig() {
  const owner  = document.getElementById('gh-owner')?.value?.trim();
  const repo   = document.getElementById('gh-repo')?.value?.trim();
  const token  = document.getElementById('gh-token')?.value?.trim();
  const branch = document.getElementById('gh-branch')?.value?.trim() || 'main';
  if (!owner || !repo || !token) { toast('Rellena usuario, repositorio y token.'); return; }
  DB.configureGitHub({ owner, repo, token, branch });
  toast('Configuración GitHub guardada. Recarga la app para sincronizar.');
}
function loadGHConfigToForm() {
  const s = DB.status();
  setValue('gh-owner', s.owner || '');
  setValue('gh-repo',  s.repo  || '');
}

/* ══════════════════════════════════════════════════════════
   21. SHARE
══════════════════════════════════════════════════════════ */
function shareLatest() {
  if (!App.lastPdfUrl) { toast('Genera un PDF primero.'); return; }
  if (navigator.share) navigator.share({ title: App.lastPdfName, text: 'Informe de mantenimiento HUCSC.' }).catch(()=>{});
  else toast('Tu navegador no soporta compartir directamente.');
}
function sendWhatsApp() {
  if (!App.lastPdfName) { toast('Genera un PDF primero.'); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent('Te envío el informe ' + App.lastPdfName + '. Adjunta el PDF descargado.')}`, '_blank');
}
function sendEmail() {
  if (!App.lastPdfName) { toast('Genera un PDF primero.'); return; }
  window.location.href = `mailto:?subject=${encodeURIComponent('Informe ' + App.lastPdfName)}&body=${encodeURIComponent('Adjunto el informe ' + App.lastPdfName + '.\n\nGenerado desde IsiVoltPro.')}`;
}

/* ══════════════════════════════════════════════════════════
   22. UTILS
══════════════════════════════════════════════════════════ */
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function esc(v = '') {
  return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function dlFile(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function setValue(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function initDate() { setValue('f-fecha', new Date().toISOString().split('T')[0]); }
function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function compressImage(file, maxSize = 1200, quality = .72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
function initMotion() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: .08 });
  document.querySelectorAll('.reveal').forEach((n, i) => {
    n.style.transitionDelay = `${Math.min(i * 40, 200)}ms`;
    io.observe(n);
  });
}
