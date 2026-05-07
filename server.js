const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

const API_KEY = '1fb16b48a6f5c84d655dbcb9719be21afd030b2480cbcd27cc50ff90481f7ce8';
const BASE_URL = 'https://api.ekyte.com';

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));
app.use(express.json());

async function fetchAllPages(url, params = {}) {
  const allData = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await axios.get(url, {
      params: { ...params, apiKey: API_KEY, page },
      timeout: 20000
    });
    const body = res.data;
    if (Array.isArray(body.data)) allData.push(...body.data);
    totalPages = body.paging?.totalPages || 1;
    page++;
    if (page > 100) break;
  }
  return allData;
}

// ── PROJETOS ─────────────────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  try {
    const params = {};
    if (req.query.workspaceId) params.workspaceId = req.query.workspaceId;
    if (req.query.squadId)     params.squadId     = req.query.squadId;
    if (req.query.startFrom)   params.startFrom   = req.query.startFrom;
    if (req.query.startTo)     params.startTo     = req.query.startTo;
    if (req.query.createdFrom) params.createdFrom = req.query.createdFrom;
    if (req.query.createdTo)   params.createdTo   = req.query.createdTo;

    const data = await fetchAllPages(`${BASE_URL}/v1.0/projects`, params);
    res.json({ data });
  } catch (err) {
    console.error('Erro /api/projects:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TIME-TRACKINGS COM CUSTO CALCULADO ───────────────────────────────────────
app.get('/api/time-trackings', async (req, res) => {
  try {
    const params = {};
    if (req.query.workspaceId) params.workspaceId = req.query.workspaceId;
    if (req.query.squadId)     params.squadId     = req.query.squadId;
    if (req.query.createdFrom) params.createdFrom = req.query.createdFrom;
    if (req.query.createdTo)   params.createdTo   = req.query.createdTo;

    const raw = await fetchAllPages(`${BASE_URL}/v1.0/time-trackings`, params);

    // Calcula custo real por entrada
    const data = raw.map(t => ({
      ...t,
      custoReal: ((t.effort || 0) / 60) * (t.accomplishedHourlyRate || 0)
    }));

    res.json({ data });
  } catch (err) {
    console.error('Erro /api/time-trackings:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CUSTO AGREGADO DE TIME-TRACKINGS POR WORKSPACE ───────────────────────────
app.get('/api/time-trackings/by-workspace', async (req, res) => {
  try {
    const params = {};
    if (req.query.createdFrom) params.createdFrom = req.query.createdFrom;
    if (req.query.createdTo)   params.createdTo   = req.query.createdTo;

    const raw = await fetchAllPages(`${BASE_URL}/v1.0/time-trackings`, params);

    const map = new Map();
    raw.forEach(t => {
      const key = t.workspaceId;
      if (!key) return;
      const cur = map.get(key) || {
        workspaceId: t.workspaceId,
        workspace: t.workspace,
        totalMinutes: 0,
        totalCusto: 0,
        entradas: 0
      };
      cur.totalMinutes += (t.effort || 0);
      cur.totalCusto   += ((t.effort || 0) / 60) * (t.accomplishedHourlyRate || 0);
      cur.entradas     += 1;
      map.set(key, cur);
    });

    const data = [...map.values()].sort((a, b) => b.totalCusto - a.totalCusto);
    res.json({ data });
  } catch (err) {
    console.error('Erro /api/time-trackings/by-workspace:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── WORKSPACES (extraído dos projetos) ───────────────────────────────────────
app.get('/api/workspaces', async (req, res) => {
  try {
    const data = await fetchAllPages(`${BASE_URL}/v1.0/projects`);
    const map = new Map();
    data.forEach(p => {
      if (p.workspaceId && p.workspace) map.set(p.workspaceId, p.workspace);
    });
    const workspaces = [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ data: workspaces });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SQUADS (extraído dos projetos) ───────────────────────────────────────────
app.get('/api/squads', async (req, res) => {
  try {
    const data = await fetchAllPages(`${BASE_URL}/v1.0/projects`);
    const map = new Map();
    data.forEach(p => {
      if (p.squadId && p.squad) map.set(p.squadId, p.squad);
    });
    const squads = [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ data: squads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Dashboard rodando em http://localhost:${PORT}`);
});
