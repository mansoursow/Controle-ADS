import React, { useState, useRef, useCallback, useMemo } from 'react';

const GRAN_LABELS = { jour: 'Par Jour', mois: 'Par Mois', annee: 'Par Année' };
const fmt     = (n) => n != null ? Number(n).toLocaleString('fr-FR') : '—';
const fmtSize = (b) => b > 1e6 ? `${(b/1e6).toFixed(1)} Mo` : `${(b/1e3).toFixed(0)} Ko`;

const TOTAL_KEYS = [
  'nb_transactions','recette_espece','recette_etc','recette_totale',
  'nb_C1','nb_C2','nb_C3','nb_C4','nb_autres',
  'recette_C1','recette_C2','recette_C3','recette_C4','recette_autres',
];

// Extrait le nom de gare depuis le nom de fichier (ex: "Nguekhokh-2021.csv" → "Nguekhokh")
const extractStation = (filename) => {
  const base = filename.replace(/\.(csv|xlsx|xls)$/i, '');
  return base.replace(/[-_\s]?\d{4}[-_\s]?/g, '').replace(/[-_\s]+$/, '').trim() || base;
};

const computeTotals = (data) => {
  const t = Object.fromEntries(TOTAL_KEYS.map(k => [k, 0]));
  for (const row of data)
    for (const k of TOTAL_KEYS)
      t[k] += row[k] || 0;
  return t;
};

const mergeData = (rows1, rows2) => {
  const map = {};
  for (const r of [...rows1, ...rows2]) {
    if (!map[r.periode]) { map[r.periode] = { ...r }; continue; }
    for (const [k, v] of Object.entries(r))
      if (k !== 'periode' && typeof v === 'number')
        map[r.periode][k] = (map[r.periode][k] || 0) + v;
  }
  return Object.values(map).sort((a, b) => a.periode.localeCompare(b.periode));
};

// ── Zone de dépôt ────────────────────────────
function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false);
  const fileRef   = useRef(null);
  const folderRef = useRef(null);

  const handle = (files) => {
    const valid = Array.from(files).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (valid.length) onFiles(valid);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all select-none
        ${dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'}`}
    >
      <div className="text-4xl mb-3">📂</div>
      <p className="font-bold text-slate-700 mb-1">Glissez vos fichiers ou dossiers ici</p>
      <p className="text-xs text-slate-400 mb-5">.xlsx · .xls · .csv — fichiers et sous-dossiers inclus</p>
      <div className="flex gap-3 justify-center">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow transition-all">
          📄 Fichiers
        </button>
        <button type="button" onClick={() => folderRef.current?.click()}
          className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow transition-all">
          🗂 Dossier
        </button>
      </div>
      <input ref={fileRef}   type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handle(e.target.files)} />
      <input ref={folderRef} type="file" webkitdirectory="true" multiple   className="hidden" onChange={e => handle(e.target.files)} />
    </div>
  );
}

// ── Badge statut fichier ─────────────────────
function FileBadge({ f, onRemove }) {
  const colors = { pending: 'bg-slate-100 text-slate-500', processing: 'bg-blue-100 text-blue-700', done: 'bg-emerald-100 text-emerald-700', error: 'bg-red-100 text-red-600' };
  const icons  = { pending: '⏳', processing: '🔄', done: '✅', error: '❌' };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[f.status] || colors.pending} border-current/20 group relative`}>
      <span>{icons[f.status] || '⏳'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{f.name}</p>
        <p className="text-xs opacity-70">
          {fmtSize(f.size)}
          {f.rows > 0 && ` · ${Number(f.rows).toLocaleString('fr-FR')} lignes`}
          {f.status === 'error' && f.message && ` · ${f.message}`}
        </p>
      </div>
      {f.status === 'processing' && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
      {f.status === 'pending' && (
        <button onClick={onRemove} className="text-slate-300 hover:text-red-500 text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">×</button>
      )}
    </div>
  );
}

// ── Tableau d'écarts ─────────────────────────
function TableauEcarts({ tableau, colonnes }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-indigo-100">
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-indigo-700 text-white font-black uppercase text-xs">
          <tr>
            <th className="p-4">Indicateur</th>
            <th className="p-4 text-right">Données Base</th>
            <th className="p-4 text-right">Rapport Exploitation</th>
            <th className="p-4 text-right">Écart (Δ)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-indigo-50">
          {tableau.map((row, i) => {
            const isNeg = row.ecart != null && row.ecart < 0;
            const isPos = row.ecart != null && row.ecart > 0;
            return (
              <tr key={i} className={isNeg ? 'bg-red-50' : isPos ? 'bg-amber-50' : 'hover:bg-indigo-50'}>
                <td className="p-4 font-bold text-slate-700">{row.indicateur}</td>
                <td className="p-4 text-right font-mono text-slate-600">{fmt(row.csv)}</td>
                <td className="p-4 text-right font-mono text-slate-500">
                  {row.rapport != null ? fmt(row.rapport) : <span className="italic text-slate-300">Non détecté</span>}
                </td>
                <td className={`p-4 text-right font-black ${isNeg ? 'text-red-600' : isPos ? 'text-amber-600' : 'text-slate-400'}`}>
                  {row.ecart != null ? (
                    <>
                      {row.ecart > 0 ? '+' : ''}{fmt(row.ecart)}
                      {isNeg && <span className="ml-2 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded">DÉFICIT</span>}
                      {isPos && <span className="ml-2 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded">SURPLUS</span>}
                    </>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {colonnes?.length > 0 && (
        <p className="p-3 text-[10px] text-slate-400 border-t border-indigo-100">
          Colonnes détectées : {colonnes.join(', ')}
        </p>
      )}
    </div>
  );
}

// ── Page principale ──────────────────────────
export default function RecettesPage({ onBack }) {
  const [fichiers, setFichiers]       = useState([]);
  const [granularite, setGranularite] = useState('mois');
  const [analysing, setAnalysing]     = useState(false);
  const [allResults, setAllResults]   = useState([]); // [{station, filename, data, totals}]
  const [logs, setLogs]               = useState([]);

  // Filtres
  const [filterGare,  setFilterGare]  = useState('all');
  const [filterAnnee, setFilterAnnee] = useState('all');
  const [filterMois,  setFilterMois]  = useState('all');

  // Comparaison rapport
  const [rapportFile,   setRapportFile]   = useState(null);
  const [comparing,     setComparing]     = useState(false);
  const [comparison,    setComparison]    = useState(null);
  const [compareError,  setCompareError]  = useState('');

  const abortRef = useRef(null);

  const addLog = (msg) =>
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 80));

  const onFiles = useCallback((newFiles) => {
    setFichiers(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const toAdd = newFiles
        .filter(f => !existing.has(f.name + f.size))
        .map(f => ({ file: f, name: f.name, size: f.size, status: 'pending', rows: 0, message: '' }));
      return [...prev, ...toAdd];
    });
  }, []);

  const removeFile = (idx) => setFichiers(prev => prev.filter((_, i) => i !== idx));

  const resetAll = () => {
    setFichiers([]);
    setAllResults([]);
    setLogs([]);
    setComparison(null);
    setRapportFile(null);
    setFilterGare('all');
    setFilterAnnee('all');
    setFilterMois('all');
  };

  const updateFile = (name, patch) =>
    setFichiers(prev => prev.map(f => f.name === name ? { ...f, ...patch } : f));

  // ── Options de filtre dérivées des données ──
  const filterOptions = useMemo(() => {
    const gares  = [...new Set(allResults.map(r => r.station))].sort();
    const annees = [...new Set(
      allResults.flatMap(r => r.data.map(d => d.periode.split('-')[0]))
    )].sort();
    const mois = [...new Set(
      allResults.flatMap(r => r.data
        .map(d => { const p = d.periode.split('-'); return p.length >= 2 ? p[1] : null; })
        .filter(Boolean)
      )
    )].sort();
    return { gares, annees, mois };
  }, [allResults]);

  // ── Vue filtrée (re-agrégation à la volée) ──
  const recettes = useMemo(() => {
    if (!allResults.length) return null;

    let filtered = allResults;
    if (filterGare !== 'all')
      filtered = filtered.filter(r => r.station === filterGare);

    let data = filtered.flatMap(r => r.data);

    if (filterAnnee !== 'all')
      data = data.filter(r => r.periode.startsWith(filterAnnee));

    if (filterMois !== 'all')
      data = data.filter(r => {
        const parts = r.periode.split('-');
        return parts.length >= 2 && parts[1] === filterMois;
      });

    // Fusionner les lignes de même période
    const merged = mergeData([], data);
    const totals = computeTotals(merged);

    // Disponibilité de la ventilation ETC/Espèces
    // 'full' = toutes les gares ont la colonne
    // 'partial' = certaines seulement
    // 'none' = aucune n'a la colonne
    const breakdownEspece = filtered.every(r => r.hasEspece !== false) ? 'full'
                          : filtered.some(r => r.hasEspece !== false)  ? 'partial' : 'none';
    const breakdownEtc    = filtered.every(r => r.hasEtc    !== false) ? 'full'
                          : filtered.some(r => r.hasEtc    !== false)  ? 'partial' : 'none';

    return { data: merged, totals, breakdownEspece, breakdownEtc };
  }, [allResults, filterGare, filterAnnee, filterMois]);

  // ── SSE : traiter un fichier ─────────────────
  const processOne = async (fich, signal) => {
    const form = new FormData();
    form.append('fichier', fich.file);
    form.append('granularite', granularite);

    const res = await fetch('/analyser-excel', { method: 'POST', body: form, signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let partial = null;
    let colFlags = { hasEspece: true, hasEtc: true }; // optimiste, corrigé à la réception

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === 'fichier_debut')  updateFile(fich.name, { status: 'processing' });
          else if (ev.type === 'progress')  updateFile(fich.name, { rows: ev.rows });
          else if (ev.type === 'fichier_done') {
            updateFile(fich.name, { status: 'done', rows: ev.rows });
            addLog(`✅ ${fich.name} — ${Number(ev.rows).toLocaleString('fr-FR')} lignes`);
          } else if (ev.type === 'colonnes') {
            const d = ev.detected;
            colFlags = { hasEspece: !!d.espece, hasEtc: !!d.etc };
            const warn = (!d.espece || !d.etc) ? ' ⚠️ ventilation ETC/Espèces absente' : '';
            addLog(`🔎 Colonnes — date:${d.date||'❌'} esp:${d.espece||'❌'} etc:${d.etc||'❌'} tot:${d.total||'❌'} cl:${d.classe||'❌'}${warn}`);
          } else if (ev.type === 'erreur') {
            updateFile(fich.name, { status: 'error', message: ev.message });
            addLog(`❌ ${fich.name} — ${ev.message}`);
          } else if (ev.type === 'resultat') {
            partial = { data: ev.data, totals: ev.totals, ...colFlags };
          }
        } catch { /* chunk incomplet */ }
      }
    }
    return partial;
  };

  // ── Lancer l'analyse ─────────────────────────
  const handleAnalyser = async () => {
    const pending = fichiers.filter(f => f.status !== 'error');
    if (!pending.length) return;

    setAnalysing(true);
    setAllResults([]);
    setComparison(null);
    setLogs([]);
    setFilterGare('all');
    setFilterAnnee('all');
    setFilterMois('all');
    setFichiers(prev => prev.map(f => ({ ...f, status: 'pending', rows: 0, message: '' })));
    abortRef.current = new AbortController();

    addLog(`🚀 Analyse de ${pending.length} fichier(s)...`);

    try {
      for (let i = 0; i < pending.length; i++) {
        if (abortRef.current.signal.aborted) break;
        const fich = pending[i];
        addLog(`📄 [${i + 1}/${pending.length}] ${fich.name}`);
        try {
          const partial = await processOne(fich, abortRef.current.signal);
          if (partial) {
            const station = extractStation(fich.name);
            setAllResults(prev => [...prev, { station, filename: fich.name, ...partial }]);
          }
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          updateFile(fich.name, { status: 'error', message: e.message });
          addLog(`❌ ${fich.name} — ${e.message}`);
        }
      }
      addLog('🏁 Analyse complète.');
    } catch (err) {
      if (err.name === 'AbortError') addLog('⚠️ Analyse annulée.');
      else addLog(`❌ Erreur : ${err.message}`);
    } finally {
      setAnalysing(false);
    }
  };

  // ── Comparer avec rapport ────────────────────
  const handleComparer = async () => {
    if (!rapportFile || !recettes) return;
    setComparing(true);
    setCompareError('');
    setComparison(null);
    try {
      const form = new FormData();
      form.append('rapport', rapportFile);
      form.append('totals', JSON.stringify(recettes.totals));
      const res  = await fetch('/comparer-totaux', { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) { setCompareError(data.error); return; }
      setComparison(data);
    } catch (e) {
      setCompareError(e.message);
    } finally {
      setComparing(false);
    }
  };

  const totalRows = fichiers.reduce((s, f) => s + (f.rows || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm px-4 py-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all">
            ← Accueil
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">
              📊 Analyse des <span className="text-emerald-600">Recettes</span>
            </h1>
            <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">
              Multi-fichiers · Agrégats · Filtres dynamiques · Comparaison Rapports
            </p>
          </div>
          {(fichiers.length > 0 || allResults.length > 0) && (
            <button onClick={resetAll}
              className="ml-auto text-xs text-slate-400 hover:text-red-500 font-bold px-3 py-1 rounded-lg hover:bg-red-50 transition-all">
              🗑 Tout effacer
            </button>
          )}
        </div>

        {/* ── Section 1 : Upload ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">
            1. Chargement des Fichiers de Données
          </h2>

          <DropZone onFiles={onFiles} />

          {fichiers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  {fichiers.length} fichier(s) · {Number(totalRows).toLocaleString('fr-FR')} lignes traitées
                </span>
                <span className="text-xs text-emerald-600 font-bold">
                  {fichiers.filter(f => f.status === 'done').length}/{fichiers.length} terminés
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {fichiers.map((f, i) => (
                  <FileBadge key={i} f={f} onRemove={() => removeFile(i)} />
                ))}
              </div>
            </div>
          )}

          {/* Granularité */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Granularité</label>
            <div className="flex gap-3">
              {Object.entries(GRAN_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => setGranularite(k)} disabled={analysing}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold border transition-all ${granularite === k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={analysing ? () => abortRef.current?.abort() : handleAnalyser}
              disabled={!analysing && fichiers.filter(f => f.status !== 'error').length === 0}
              className={`flex-1 py-3 rounded-xl font-bold text-white text-sm shadow-md transition-all
                ${analysing ? 'bg-red-500 hover:bg-red-600'
                  : fichiers.length === 0 ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {analysing ? '⛔ Annuler' : `📊 Analyser (${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''})`}
            </button>
          </div>

          {logs.length > 0 && (
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-slate-300 h-28 overflow-y-auto shadow-inner">
              {logs.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          )}
        </div>

        {/* ── Section 2 : Filtres + Résultats ── */}
        {allResults.length > 0 && recettes && (
          <>
            {/* Filtres dynamiques */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-4">
                2. Filtrer les Résultats
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Filtre gare */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Gare</label>
                  <select value={filterGare} onChange={e => setFilterGare(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 bg-white">
                    <option value="all">Toutes les gares</option>
                    {filterOptions.gares.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* Filtre année */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Année</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterAnnee('all')}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${filterAnnee === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}>
                      Toutes
                    </button>
                    {filterOptions.annees.map(a => (
                      <button key={a} onClick={() => setFilterAnnee(a)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${filterAnnee === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtre mois */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mois</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterMois('all')}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${filterMois === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                      Tous
                    </button>
                    {filterOptions.mois.map(m => (
                      <button key={m} onClick={() => setFilterMois(m)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${filterMois === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Badge sélection active */}
              {(filterGare !== 'all' || filterAnnee !== 'all' || filterMois !== 'all') && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-slate-500 font-bold uppercase">Filtre actif :</span>
                  {filterGare  !== 'all' && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">🏢 {filterGare}</span>}
                  {filterAnnee !== 'all' && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">📅 {filterAnnee}</span>}
                  {filterMois  !== 'all' && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">🗓 Mois {filterMois}</span>}
                  <button onClick={() => { setFilterGare('all'); setFilterAnnee('all'); setFilterMois('all'); }}
                    className="text-xs text-red-400 hover:text-red-600 font-bold underline">
                    Effacer les filtres
                  </button>
                </div>
              )}
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Transactions & Total — toujours disponibles */}
              {[
                { label: 'Total Transactions',    val: recettes.totals.nb_transactions, cls: 'text-blue-600',    bd: 'full' },
                { label: 'Recette Totale (FCFA)', val: recettes.totals.recette_totale,  cls: 'text-emerald-600', bd: 'full' },
                { label: 'Recette ETC (FCFA)',    val: recettes.totals.recette_etc,     cls: 'text-purple-600',  bd: recettes.breakdownEtc    },
                { label: 'Recette Espèces (FCFA)',val: recettes.totals.recette_espece,  cls: 'text-amber-600',   bd: recettes.breakdownEspece },
              ].map(({ label, val, cls, bd }) => (
                <div key={label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
                  {bd === 'none' ? (
                    <p className="text-2xl font-black text-slate-300">N/D</p>
                  ) : (
                    <p className={`text-2xl font-black ${cls}`}>{fmt(val)}</p>
                  )}
                  <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">{label}</p>
                  {bd === 'none'    && <p className="text-[9px] text-red-400 font-bold mt-1">⚠️ Colonne absente du fichier</p>}
                  {bd === 'partial' && <p className="text-[9px] text-amber-500 font-bold mt-1">⚠️ Données partielles</p>}
                </div>
              ))}
            </div>

            {/* Mix catégories */}
            <div className="grid grid-cols-5 gap-3">
              {['C1','C2','C3','C4'].map(cl => {
                const nb  = recettes.totals[`nb_${cl}`];
                const pct = ((nb / (recettes.totals.nb_transactions || 1)) * 100).toFixed(1);
                return (
                  <div key={cl} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
                    <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black mb-2">{cl}</span>
                    <p className="text-xl font-black text-slate-700">{fmt(nb)}</p>
                    <p className="text-xs text-slate-500 mt-1">{pct}% du trafic</p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{fmt(recettes.totals[`recette_${cl}`])} FCFA</p>
                  </div>
                );
              })}
              {/* Autres (C?0, catégories inconnues) */}
              {(() => {
                const nb  = recettes.totals.nb_autres || 0;
                const pct = ((nb / (recettes.totals.nb_transactions || 1)) * 100).toFixed(1);
                return (
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
                    <span className="inline-block bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-black mb-2">Autres</span>
                    <p className="text-xl font-black text-slate-500">{fmt(nb)}</p>
                    <p className="text-xs text-slate-400 mt-1">{pct}% du trafic</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">{fmt(recettes.totals.recette_autres || 0)} FCFA</p>
                    {nb > 0 && <p className="text-[9px] text-amber-500 mt-1 font-bold">⚠️ Classe non reconnue</p>}
                  </div>
                );
              })()}
            </div>

            {/* Tableau détaillé */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-6 py-3 flex items-center justify-between">
                <h2 className="text-white font-black text-sm uppercase tracking-wider">
                  Recettes {GRAN_LABELS[granularite]}
                  {filterGare  !== 'all'  && ` · ${filterGare}`}
                  {filterAnnee !== 'all'  && ` · ${filterAnnee}`}
                  {filterMois  !== 'all'  && ` · Mois ${filterMois}`}
                </h2>
                <div className="flex items-center gap-3">
                  {(recettes.breakdownEtc !== 'full' || recettes.breakdownEspece !== 'full') && (
                    <span className="text-amber-400 text-[10px] font-bold">⚠️ Ventilation ETC/Espèces incomplète</span>
                  )}
                  <span className="text-slate-400 text-xs">{recettes.data.length} période(s)</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-700 text-white font-black uppercase">
                    <tr>
                      <th className="p-3">Période</th>
                      <th className="p-3 text-right">Nb Tx</th>
                      <th className="p-3 text-right">Recette Totale</th>
                      <th className="p-3 text-right">
                        ETC {recettes.breakdownEtc === 'none' && <span className="text-red-400 normal-case font-normal">(N/D)</span>}
                        {recettes.breakdownEtc === 'partial' && <span className="text-amber-400 normal-case font-normal">(partiel)</span>}
                      </th>
                      <th className="p-3 text-right">
                        Espèces {recettes.breakdownEspece === 'none' && <span className="text-red-400 normal-case font-normal">(N/D)</span>}
                        {recettes.breakdownEspece === 'partial' && <span className="text-amber-400 normal-case font-normal">(partiel)</span>}
                      </th>
                      <th className="p-3 text-right">C1</th>
                      <th className="p-3 text-right">C2</th>
                      <th className="p-3 text-right">C3</th>
                      <th className="p-3 text-right">C4</th>
                      <th className="p-3 text-right text-slate-300">Autres</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recettes.data.length === 0 ? (
                      <tr><td colSpan="10" className="p-8 text-center text-slate-400 italic">Aucun résultat pour ce filtre</td></tr>
                    ) : recettes.data.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-700">{row.periode}</td>
                        <td className="p-3 text-right text-slate-600">{fmt(row.nb_transactions)}</td>
                        <td className="p-3 text-right font-bold text-emerald-700">{fmt(row.recette_totale)}</td>
                        <td className="p-3 text-right text-purple-600">
                          {recettes.breakdownEtc === 'none' ? <span className="text-slate-300 italic">—</span> : fmt(row.recette_etc)}
                        </td>
                        <td className="p-3 text-right text-amber-600">
                          {recettes.breakdownEspece === 'none' ? <span className="text-slate-300 italic">—</span> : fmt(row.recette_espece)}
                        </td>
                        <td className="p-3 text-right text-slate-500">{fmt(row.nb_C1)}</td>
                        <td className="p-3 text-right text-slate-500">{fmt(row.nb_C2)}</td>
                        <td className="p-3 text-right text-slate-500">{fmt(row.nb_C3)}</td>
                        <td className="p-3 text-right text-slate-500">{fmt(row.nb_C4)}</td>
                        <td className={`p-3 text-right text-xs ${(row.nb_autres||0) > 0 ? 'text-amber-600 font-bold' : 'text-slate-300'}`}>
                          {(row.nb_autres || 0) > 0 ? fmt(row.nb_autres) : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-800 text-white font-black">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-right">{fmt(recettes.totals.nb_transactions)}</td>
                      <td className="p-3 text-right text-emerald-300">{fmt(recettes.totals.recette_totale)}</td>
                      <td className="p-3 text-right text-purple-300">
                        {recettes.breakdownEtc === 'none' ? <span className="text-slate-500 italic font-normal">N/D</span> : fmt(recettes.totals.recette_etc)}
                      </td>
                      <td className="p-3 text-right text-amber-300">
                        {recettes.breakdownEspece === 'none' ? <span className="text-slate-500 italic font-normal">N/D</span> : fmt(recettes.totals.recette_espece)}
                      </td>
                      <td className="p-3 text-right">{fmt(recettes.totals.nb_C1)}</td>
                      <td className="p-3 text-right">{fmt(recettes.totals.nb_C2)}</td>
                      <td className="p-3 text-right">{fmt(recettes.totals.nb_C3)}</td>
                      <td className="p-3 text-right">{fmt(recettes.totals.nb_C4)}</td>
                      <td className={`p-3 text-right text-xs ${(recettes.totals.nb_autres||0) > 0 ? 'text-amber-400' : 'text-slate-500 font-normal'}`}>
                        {(recettes.totals.nb_autres || 0) > 0 ? fmt(recettes.totals.nb_autres) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 3 : Comparaison rapport ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 p-6 space-y-4">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                3. Comparaison avec Rapport d'Exploitation
              </h2>
              <p className="text-xs text-slate-500">
                La comparaison porte sur la vue filtrée ci-dessus. Colonnes Excel attendues (noms flexibles) :
                {['Vehicules_Total','Vehicules_ETC','Vehicules_MTC','Recette_Total','C1','C2','C3','C4'].map(c => (
                  <span key={c} className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 mx-1 rounded text-[10px]">{c}</span>
                ))}
              </p>

              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fichier Rapport (.xlsx)</label>
                  <input type="file" accept=".xlsx,.xls"
                    onChange={e => { setRapportFile(e.target.files[0]); setComparison(null); }}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
                <button onClick={handleComparer} disabled={!rapportFile || comparing}
                  className={`px-8 py-3 rounded-xl font-bold text-white text-sm shadow-md transition-all whitespace-nowrap
                    ${!rapportFile || comparing ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {comparing ? '⏳ Comparaison...' : '🔍 Comparer'}
                </button>
              </div>

              {compareError && <p className="text-red-600 text-sm font-medium">{compareError}</p>}
              {comparison && <TableauEcarts tableau={comparison.tableau} colonnes={comparison.colonnes_rapport} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
