/* ═══════════════════════════════════════════════════════════
   ISIVOLT PRO — Capa de datos
   GitHub Pages + JSON via API · localStorage como caché
   ═══════════════════════════════════════════════════════════ */

const DB = (() => {

  /* ── CONFIG GITHUB ─────────────────────────────────────── */
  const GH = {
    owner: '',      // ← tu usuario GitHub
    repo:  '',      // ← nombre del repo
    token: '',      // ← Personal Access Token (fine-grained, contents:write)
    branch: 'main',
    path: 'data',   // carpeta dentro del repo
  };

  /* ── COLECCIONES ────────────────────────────────────────── */
  const COLS = ['informes', 'ots', 'instalaciones', 'inventario'];

  /* ── ESTADO LOCAL ───────────────────────────────────────── */
  let _cache = {};     // { informes:[], ots:[], instalaciones:[], inventario:[] }
  let _shas  = {};     // SHA de cada fichero en GitHub para actualizar
  let _ready = false;
  let _online = false;

  /* ── INIT ───────────────────────────────────────────────── */
  async function init(config = {}) {
    Object.assign(GH, config);
    _loadLocal();
    _online = !!GH.owner && !!GH.repo && !!GH.token;
    if (_online) {
      try { await _pullAll(); } catch(e) { console.warn('[DB] GitHub pull failed, using local:', e.message); }
    }
    _ready = true;
    return _online;
  }

  /* ── LECTURA LOCAL ──────────────────────────────────────── */
  function _loadLocal() {
    COLS.forEach(col => {
      try {
        const raw = localStorage.getItem(`ivp_${col}`);
        _cache[col] = raw ? JSON.parse(raw) : [];
      } catch { _cache[col] = []; }
    });
  }

  /* ── ESCRITURA LOCAL ────────────────────────────────────── */
  function _saveLocal(col) {
    try { localStorage.setItem(`ivp_${col}`, JSON.stringify(_cache[col])); } catch {}
  }

  /* ── GITHUB API ─────────────────────────────────────────── */
  async function _ghFetch(endpoint, options = {}) {
    const url = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${GH.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok && res.status !== 404) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    return res.status === 404 ? null : res.json();
  }

  async function _pullAll() {
    await Promise.all(COLS.map(col => _pullCol(col)));
  }

  async function _pullCol(col) {
    const file = `${GH.path}/${col}.json`;
    const res = await _ghFetch(file);
    if (!res) return; // archivo no existe aún
    _shas[col] = res.sha;
    const data = JSON.parse(atob(res.content.replace(/\n/g, '')));
    _cache[col] = Array.isArray(data) ? data : [];
    _saveLocal(col);
  }

  async function _pushCol(col) {
    if (!_online) return;
    const file  = `${GH.path}/${col}.json`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(_cache[col], null, 2))));
    const body = {
      message: `IsiVoltPro: update ${col} (${new Date().toISOString()})`,
      content,
      branch: GH.branch,
    };
    if (_shas[col]) body.sha = _shas[col];
    const res = await _ghFetch(file, { method: 'PUT', body: JSON.stringify(body) });
    if (res?.content?.sha) _shas[col] = res.content.sha;
  }

  /* ── API PÚBLICA ────────────────────────────────────────── */

  /** Devuelve todos los registros de una colección */
  function getAll(col) {
    return [...(_cache[col] || [])];
  }

  /** Devuelve un registro por id */
  function getById(col, id) {
    return (_cache[col] || []).find(r => r.id === id) || null;
  }

  /** Inserta o actualiza (upsert por id). Devuelve el registro. */
  async function save(col, record) {
    if (!_cache[col]) _cache[col] = [];
    if (!record.id) record.id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    record.updatedAt = new Date().toISOString();
    const idx = _cache[col].findIndex(r => r.id === record.id);
    if (idx >= 0) _cache[col][idx] = record;
    else          _cache[col].unshift(record);
    _cache[col] = _cache[col].slice(0, 1000); // límite seguro
    _saveLocal(col);
    try { await _pushCol(col); } catch(e) { console.warn('[DB] Push failed:', e.message); }
    return record;
  }

  /** Elimina un registro por id */
  async function remove(col, id) {
    if (!_cache[col]) return;
    _cache[col] = _cache[col].filter(r => r.id !== id);
    _saveLocal(col);
    try { await _pushCol(col); } catch(e) { console.warn('[DB] Push failed:', e.message); }
  }

  /** Actualiza solo campos específicos de un registro */
  async function patch(col, id, fields) {
    const record = getById(col, id);
    if (!record) return null;
    return save(col, { ...record, ...fields });
  }

  /** Exporta backup completo como JSON */
  function exportBackup() {
    return {
      app: 'IsiVoltPro',
      version: 'v1',
      exportedAt: new Date().toISOString(),
      data: { ...(_cache) },
    };
  }

  /** Importa backup */
  async function importBackup(json) {
    if (!json?.data) throw new Error('Formato de backup incorrecto');
    for (const col of COLS) {
      if (Array.isArray(json.data[col])) {
        _cache[col] = json.data[col];
        _saveLocal(col);
        try { await _pushCol(col); } catch {}
      }
    }
  }

  /** Devuelve configuración de GitHub (sin token) */
  function status() {
    return { online: _online, ready: _ready, owner: GH.owner, repo: GH.repo };
  }

  /** Guarda config GitHub en localStorage */
  function configureGitHub(cfg) {
    Object.assign(GH, cfg);
    try { localStorage.setItem('ivp_gh_config', JSON.stringify({ owner: GH.owner, repo: GH.repo, token: GH.token, branch: GH.branch })); } catch {}
    _online = !!(GH.owner && GH.repo && GH.token);
  }

  /** Carga config GitHub desde localStorage */
  function loadGitHubConfig() {
    try {
      const raw = localStorage.getItem('ivp_gh_config');
      if (raw) { const cfg = JSON.parse(raw); Object.assign(GH, cfg); }
    } catch {}
  }

  return { init, getAll, getById, save, remove, patch, exportBackup, importBackup, status, configureGitHub, loadGitHubConfig };
})();
