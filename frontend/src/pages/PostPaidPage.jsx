import React, { useState, useRef, useCallback } from 'react';

const fmt     = (n) => n != null ? Number(n).toLocaleString('fr-FR') : '—';
const fmtSize = (b) => b > 1e6 ? `${(b / 1e6).toFixed(1)} Mo` : `${(b / 1e3).toFixed(0)} Ko`;

const STATUT_CFG = {
  ok:          { label: 'OK',               bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  surfacture:  { label: 'SURFACTURATION',   bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500'     },
  sousfacture: { label: 'SOUS-FACTURATION', bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
};

// ── Zone fichier unique (plaques) ────────────────────────────────────────────
function SingleFileZone({ file, onFile, label, hint }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handle = (files) => {
    const f = Array.from(files).find(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (f) onFile(f);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all select-none
        ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white'}`}
    >
      <div className="text-3xl mb-2">📋</div>
      <p className="font-bold text-slate-700 mb-1 text-sm">{label}</p>
      <p className="text-xs text-slate-400 mb-4">{hint}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition-all"
      >
        Choisir le fichier
      </button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
             onChange={e => handle(e.target.files)} />

      {file && (
        <div className="mt-4 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs">
          <span className="text-indigo-800 font-semibold truncate max-w-[200px]">{file.name}</span>
          <span className="text-indigo-400 ml-2 shrink-0">{fmtSize(file.size)}</span>
        </div>
      )}
    </div>
  );
}

// ── Zone péage multi-fichiers + dossier ──────────────────────────────────────
function PeageDropZone({ files, onFiles }) {
  const [dragging, setDragging] = useState(false);
  const fileRef   = useRef(null);
  const folderRef = useRef(null);

  const handle = (fileList) => {
    const valid = Array.from(fileList).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (valid.length) onFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))];
    });
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all select-none
        ${dragging ? 'border-violet-500 bg-violet-50' : 'border-slate-300 bg-white'}`}
    >
      <div className="text-3xl mb-2">🗂️</div>
      <p className="font-bold text-slate-700 mb-1 text-sm">Glissez vos fichiers ou un dossier ici</p>
      <p className="text-xs text-slate-400 mb-4">.xlsx · .xls · .csv — fichiers et sous-dossiers inclus</p>
      <div className="flex gap-3 justify-center">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow transition-all">
          📄 Fichiers
        </button>
        <button type="button" onClick={() => folderRef.current?.click()}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition-all">
          🗂 Dossier
        </button>
      </div>
      <input ref={fileRef}   type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handle(e.target.files)} />
      <input ref={folderRef} type="file" webkitdirectory="true" multiple   className="hidden" onChange={e => handle(e.target.files)} />

      {files.length > 0 && (
        <ul className="mt-4 space-y-1 text-left max-h-40 overflow-y-auto">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-700 font-medium truncate max-w-[200px]">{f.name}</span>
              <span className="text-slate-400 ml-2 shrink-0">{fmtSize(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Carte stat ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'slate' }) {
  const colors = {
    slate:   'bg-slate-50 border-slate-200 text-slate-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    red:     'bg-red-50 border-red-200 text-red-800',
    amber:   'bg-amber-50 border-amber-200 text-amber-800',
    violet:  'bg-violet-50 border-violet-200 text-violet-800',
  };
  return (
    <div className={`border rounded-2xl p-5 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

// ── Lecture SSE ───────────────────────────────────────────────────────────────
async function readSSE(url, body, onEvent, signal) {
  const res = await fetch(url, { method: 'POST', body, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const part of parts) {
      const line = part.replace(/^data:\s*/, '').trim();
      if (!line) continue;
      try { onEvent(JSON.parse(line)); } catch {}
    }
  }
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function PostPaidPage({ onBack }) {
  const [fichierPlaques,  setFichierPlaques]  = useState(null);
  const [fichiersPeage,   setFichiersPeage]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [progLabel, setProgLabel] = useState('');
  const [logs,      setLogs]      = useState([]);
  const [resultats, setResultats] = useState([]);
  const [totaux,    setTotaux]    = useState(null);
  const [filtre,    setFiltre]    = useState('tous');
  const [search,    setSearch]    = useState('');
  const abortRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [{ msg, type, ts: new Date().toLocaleTimeString('fr-FR') }, ...prev].slice(0, 80));
  }, []);

  const lancer = async () => {
    if (!fichierPlaques || !fichiersPeage.length) return;
    setLoading(true);
    setProgress(0);
    setProgLabel('Lecture de la liste de plaques…');
    setLogs([]);
    setResultats([]);
    setTotaux(null);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      // ── Étape 1 : lire le fichier de plaques (requête légère JSON) ──────────
      addLog(`📋 Lecture du fichier de plaques : ${fichierPlaques.name}`);
      const fd1 = new FormData();
      fd1.append('fichier_plaques', fichierPlaques);
      const resp = await fetch('/controle-postpaid/plaques', { method: 'POST', body: fd1, signal });
      if (!resp.ok) throw new Error(`Erreur lecture plaques : HTTP ${resp.status}`);
      const plaquesData = await resp.json();
      if (plaquesData.error) throw new Error(plaquesData.error);

      const plaquesMap = {};   // {plaque: nb_liste}
      for (const { plaque, nb_liste } of plaquesData.plaques) plaquesMap[plaque] = nb_liste;

      addLog(`✅ ${plaquesData.total_uniques} plaques uniques (${plaquesData.total_lignes} lignes au total)`);
      setProgress(5);

      // ── Étape 2 : traiter les fichiers péage un par un ─────────────────────
      const total = 1 + fichiersPeage.length;
      const peageCounts = {};  // {plaque: total_nb_passages} accumulé

      for (let i = 0; i < fichiersPeage.length; i++) {
        if (signal.aborted) break;
        const f = fichiersPeage[i];
        const pct = Math.round(5 + ((i + 1) / total) * 90);
        setProgLabel(`Péage ${i + 1}/${fichiersPeage.length} : ${f.name}`);
        addLog(`📄 [${i + 1}/${fichiersPeage.length}] ${f.name}`);

        const fd2 = new FormData();
        fd2.append('fichier_peage', f);

        await readSSE('/controle-postpaid/peage-file', fd2, (evt) => {
          if (evt.type === 'progress') addLog(evt.message, 'progress');
          if (evt.type === 'erreur')   addLog(evt.message, 'error');
          if (evt.type === 'resultat') {
            for (const [plaque, count] of Object.entries(evt.counts)) {
              peageCounts[plaque] = (peageCounts[plaque] || 0) + count;
            }
          }
        }, signal);

        setProgress(pct);
      }

      // ── Étape 3 : calcul du rapprochement ───────────────────────────────────
      setProgLabel('Rapprochement…');
      const rows = Object.entries(plaquesMap).map(([plaque, nb_liste]) => {
        const nb_peage = peageCounts[plaque] || 0;
        const ecart    = nb_liste - nb_peage;
        return {
          plaque,
          nb_liste,
          nb_peage,
          ecart,
          statut: ecart === 0 ? 'ok' : ecart > 0 ? 'surfacture' : 'sousfacture',
        };
      });

      const t = {
        total_plaques:  rows.length,
        total_liste:    rows.reduce((s, r) => s + r.nb_liste,  0),
        total_peage:    rows.reduce((s, r) => s + r.nb_peage,  0),
        total_ecart:    rows.reduce((s, r) => s + r.ecart,     0),
        nb_ok:          rows.filter(r => r.statut === 'ok').length,
        nb_surfacture:  rows.filter(r => r.statut === 'surfacture').length,
        nb_sousfacture: rows.filter(r => r.statut === 'sousfacture').length,
      };

      setResultats(rows);
      setTotaux(t);
      setProgress(100);
      setProgLabel('Terminé');
      addLog(`✅ Rapprochement terminé — ${rows.length} plaques analysées`);

    } catch (e) {
      if (e.name !== 'AbortError') addLog(`Erreur : ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const arreter = () => {
    abortRef.current?.abort();
    setLoading(false);
    addLog('Analyse interrompue.', 'warning');
  };

  const lignesFiltrees = resultats.filter(r => {
    const matchFiltre = filtre === 'tous' || r.statut === filtre;
    const matchSearch = !search || r.plaque.includes(search.toUpperCase());
    return matchFiltre && matchSearch;
  });

  const canLaunch = fichierPlaques && fichiersPeage.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 to-violet-500 text-white px-6 py-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={onBack}
            className="text-violet-200 hover:text-white transition-colors text-sm font-medium">
            ← Retour
          </button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">💳 Contrôle Recette Post Paid</h1>
            <p className="text-violet-200 text-xs mt-0.5">
              Vérification du nombre de passages péage par plaque d'immatriculation
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Upload zones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="text-lg">📋</span> Liste des plaques
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Fichier avec une colonne <strong>Plaque d'immatriculation</strong> listant
              les plaques à vérifier (les doublons comptent comme des passages facturés).
            </p>
            <SingleFileZone
              file={fichierPlaques}
              onFile={setFichierPlaques}
              label="Fichier liste de plaques"
              hint="1 colonne : Plaque d'immatriculation · .xlsx · .xls · .csv"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="text-lg">📂</span> Données Péage
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Fichiers de transactions du péage contenant les plaques d'immatriculation
              (mêmes fichiers que l'Analyse des Recettes).
            </p>
            <PeageDropZone files={fichiersPeage} onFiles={setFichiersPeage} />
          </div>
        </div>

        {/* Bouton lancement */}
        <div className="flex gap-4">
          {!loading ? (
            <button onClick={lancer} disabled={!canLaunch}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed
                         text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-md">
              🔍 Lancer le Contrôle Post Paid
              {canLaunch && (
                <span className="ml-2 text-violet-200 font-normal text-sm">
                  ({Object.keys({}).length} plaques · {fichiersPeage.length} fichier{fichiersPeage.length > 1 ? 's' : ''} péage)
                </span>
              )}
            </button>
          ) : (
            <button onClick={arreter}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl text-base transition-colors">
              ⏹ Arrêter
            </button>
          )}
        </div>

        {/* Barre de progression */}
        {(loading || progress > 0) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700 truncate max-w-[80%]">
                {progLabel || 'Traitement en cours…'}
              </span>
              <span className={`text-sm font-extrabold tabular-nums ${progress === 100 ? 'text-emerald-600' : 'text-violet-600'}`}>
                {progress}%
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs overflow-y-auto max-h-36">
            {logs.map((l, i) => (
              <div key={i} className={`mb-0.5 ${
                l.type === 'error'    ? 'text-red-400'    :
                l.type === 'warning' ? 'text-amber-400'  :
                l.type === 'progress'? 'text-violet-300' : 'text-slate-300'
              }`}>
                <span className="text-slate-600 mr-2">{l.ts}</span>{l.msg}
              </div>
            ))}
          </div>
        )}

        {/* Résultats */}
        {totaux && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Plaques uniques"    value={fmt(totaux.total_plaques)} color="violet" />
              <StatCard label="Passages (liste)"   value={fmt(totaux.total_liste)}   sub="Lignes dans le fichier" />
              <StatCard label="Passages (péage)"   value={fmt(totaux.total_peage)}   sub="Relevés dans les données" />
              <StatCard
                label="Écart total"
                value={(totaux.total_ecart > 0 ? '+' : '') + fmt(totaux.total_ecart)}
                color={totaux.total_ecart === 0 ? 'emerald' : totaux.total_ecart > 0 ? 'red' : 'amber'}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Conformes"          value={fmt(totaux.nb_ok)}          color="emerald" />
              <StatCard label="Surfacturations"    value={fmt(totaux.nb_surfacture)}   color="red"     />
              <StatCard label="Sous-facturations"  value={fmt(totaux.nb_sousfacture)}  color="amber"   />
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'tous',        label: `Toutes (${resultats.length})` },
                    { key: 'ok',          label: `OK (${totaux.nb_ok})` },
                    { key: 'surfacture',  label: `Surfacturation (${totaux.nb_surfacture})` },
                    { key: 'sousfacture', label: `Sous-facturation (${totaux.nb_sousfacture})` },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setFiltre(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        filtre === key
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="text" placeholder="Rechercher une plaque…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="ml-auto border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 w-48"
                />
              </div>
            </div>

            {/* Tableau */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">
                  Détail par plaque
                  <span className="ml-2 text-slate-400 font-normal text-sm">
                    {lignesFiltrees.length} plaque{lignesFiltrees.length > 1 ? 's' : ''}
                  </span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Plaque</th>
                      <th className="px-4 py-3 text-right">Passages (liste)</th>
                      <th className="px-4 py-3 text-right">Passages (péage)</th>
                      <th className="px-4 py-3 text-right">Écart</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignesFiltrees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                          Aucune plaque correspondant aux filtres
                        </td>
                      </tr>
                    ) : lignesFiltrees.map((r, i) => {
                      const cfg = STATUT_CFG[r.statut];
                      return (
                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${
                          r.statut === 'surfacture'  ? 'bg-red-50/40'   :
                          r.statut === 'sousfacture' ? 'bg-amber-50/40' : ''
                        }`}>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.plaque}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{fmt(r.nb_liste)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {r.nb_peage > 0 ? fmt(r.nb_peage) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            r.ecart > 0 ? 'text-red-600' :
                            r.ecart < 0 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {r.ecart !== 0 ? `${r.ecart > 0 ? '+' : ''}${fmt(r.ecart)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {lignesFiltrees.length > 0 && (
                    <tfoot className="bg-slate-800 text-white text-sm font-bold">
                      <tr>
                        <td className="px-4 py-3">TOTAL</td>
                        <td className="px-4 py-3 text-right">
                          {fmt(lignesFiltrees.reduce((s, r) => s + r.nb_liste, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fmt(lignesFiltrees.reduce((s, r) => s + r.nb_peage, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const e = lignesFiltrees.reduce((s, r) => s + r.ecart, 0);
                            return <span className={e > 0 ? 'text-red-300' : e < 0 ? 'text-amber-300' : 'text-emerald-300'}>
                              {(e > 0 ? '+' : '') + fmt(e)}
                            </span>;
                          })()}
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
