import React, { useState, useRef, useCallback } from 'react';

const fmt     = (n) => n != null ? Number(n).toLocaleString('fr-FR') : '—';
const fmtSize = (b) => b > 1e6 ? `${(b / 1e6).toFixed(1)} Mo` : `${(b / 1e3).toFixed(0)} Ko`;

const STATUT_CONFIG = {
  ok:          { label: 'OK',           bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  surfacture:  { label: 'SURFACTURATION', bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500'     },
  sousfacture: { label: 'SOUS-FACTURATION', bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
};

const FILE_ZONE_COLORS = {
  violet: {
    drag:   'border-violet-500 bg-violet-50',
    static: 'border-slate-300 bg-white',
    btn:    'bg-violet-600 hover:bg-violet-700',
  },
  indigo: {
    drag:   'border-indigo-500 bg-indigo-50',
    static: 'border-slate-300 bg-white',
    btn:    'bg-indigo-600 hover:bg-indigo-700',
  },
};

function FileZone({ label, icon, color, accept, multiple, files, onFiles }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const colors = FILE_ZONE_COLORS[color] || FILE_ZONE_COLORS.violet;

  const handle = (fileList) => {
    const valid = Array.from(fileList).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (valid.length) onFiles(valid);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={`border-2 border-dashed rounded-2xl p-6 transition-all ${dragging ? colors.drag : colors.static}`}
    >
      <div className="text-3xl mb-2 text-center">{icon}</div>
      <p className="font-bold text-slate-700 text-center mb-1 text-sm">{label}</p>
      <p className="text-xs text-slate-400 text-center mb-4">.xlsx · .xls · .csv</p>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${colors.btn} text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors`}
        >
          Choisir {multiple ? 'des fichiers' : 'un fichier'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={e => handle(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="text-slate-700 font-medium truncate max-w-[180px]">{f.name}</span>
              <span className="text-slate-400 ml-2 shrink-0">{fmtSize(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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

export default function PostPaidPage({ onBack }) {
  const [fichiersPeage,    setFichiersPeage]    = useState([]);
  const [fichiersFactures, setFichiersFactures] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [logs,       setLogs]       = useState([]);
  const [resultats,  setResultats]  = useState([]);
  const [totaux,     setTotaux]     = useState(null);
  const [filtre,     setFiltre]     = useState('tous');
  const [search,     setSearch]     = useState('');
  const abortRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [{msg, type, ts: new Date().toLocaleTimeString('fr-FR')}, ...prev].slice(0, 80));
  }, []);

  const lancer = async () => {
    if (!fichiersPeage.length || !fichiersFactures.length) return;
    setLoading(true);
    setLogs([]);
    setResultats([]);
    setTotaux(null);

    const fd = new FormData();
    fichiersPeage.forEach(f    => fd.append('fichiers_peage',    f));
    fichiersFactures.forEach(f => fd.append('fichiers_factures', f));

    abortRef.current = new AbortController();
    try {
      const res = await fetch('/controle-postpaid', {
        method: 'POST',
        body: fd,
        signal: abortRef.current.signal,
      });
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
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'info')     addLog(evt.message, 'info');
            if (evt.type === 'progress') addLog(evt.message, 'progress');
            if (evt.type === 'warning')  addLog(evt.message, 'warning');
            if (evt.type === 'erreur')   addLog(evt.message, 'error');
            if (evt.type === 'resultat') {
              setResultats(evt.data || []);
              setTotaux(evt.totaux || null);
            }
            if (evt.type === 'done') setLoading(false);
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') addLog(`Erreur réseau : ${e.message}`, 'error');
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
    const matchSearch = !search || r.plaque.includes(search.toUpperCase()) || r.client.toLowerCase().includes(search.toLowerCase());
    return matchFiltre && matchSearch;
  });

  const canLaunch = fichiersPeage.length > 0 && fichiersFactures.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 to-violet-500 text-white px-6 py-5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-violet-200 hover:text-white transition-colors text-sm font-medium flex items-center gap-1"
          >
            ← Retour
          </button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">💳 Contrôle Recette Post Paid</h1>
            <p className="text-violet-200 text-xs mt-0.5">
              Rapprochement passages péage réels vs passages facturés aux clients post-paid
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Upload zones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-lg">📂</span> Données Péage
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Fichiers de transactions du péage contenant les plaques d'immatriculation
              (mêmes fichiers que l'Analyse des Recettes).
            </p>
            <FileZone
              label="Fichiers péage (transactions)"
              icon="🛣️"
              color="violet"
              accept=".xlsx,.xls,.csv"
              multiple
              files={fichiersPeage}
              onFiles={setFichiersPeage}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-lg">🧾</span> Factures Post Paid
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Fichiers de facturation mensuelle des clients post-paid (ex : SAGAM, SENAS AUCHAN…)
              listant les plaques et le nombre de passages facturés.
            </p>
            <FileZone
              label="Fichiers factures clients"
              icon="💳"
              color="indigo"
              accept=".xlsx,.xls,.csv"
              multiple
              files={fichiersFactures}
              onFiles={setFichiersFactures}
            />
          </div>
        </div>

        {/* Bouton lancement */}
        <div className="flex gap-4">
          {!loading ? (
            <button
              onClick={lancer}
              disabled={!canLaunch}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed
                         text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-md"
            >
              🔍 Lancer le Contrôle Post Paid
              {canLaunch && (
                <span className="ml-2 text-violet-200 font-normal text-sm">
                  ({fichiersPeage.length} péage · {fichiersFactures.length} facture{fichiersFactures.length > 1 ? 's' : ''})
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={arreter}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl text-base transition-colors"
            >
              ⏹ Arrêter
            </button>
          )}
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs overflow-y-auto max-h-40">
            {logs.map((l, i) => (
              <div key={i} className={`mb-0.5 ${
                l.type === 'error'    ? 'text-red-400'    :
                l.type === 'warning' ? 'text-amber-400'  :
                l.type === 'progress'? 'text-violet-300' :
                'text-slate-300'
              }`}>
                <span className="text-slate-600 mr-2">{l.ts}</span>{l.msg}
              </div>
            ))}
          </div>
        )}

        {/* Résultats */}
        {totaux && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Lignes facturées"
                value={fmt(totaux.total_lignes)}
                color="violet"
              />
              <StatCard
                label="Passages facturés"
                value={fmt(totaux.total_passages_fact)}
                sub="Total dans les factures"
                color="slate"
              />
              <StatCard
                label="Passages péage"
                value={fmt(totaux.total_passages_peage)}
                sub="Total relevé dans les données"
                color="slate"
              />
              <StatCard
                label="Écart total"
                value={(totaux.total_ecart > 0 ? '+' : '') + fmt(totaux.total_ecart)}
                sub="Facturés − Péage"
                color={totaux.total_ecart === 0 ? 'emerald' : totaux.total_ecart > 0 ? 'red' : 'amber'}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Conformes"        value={fmt(totaux.nb_ok)}          color="emerald" />
              <StatCard label="Surfacturations"  value={fmt(totaux.nb_surfacture)}  color="red"     />
              <StatCard label="Sous-facturations" value={fmt(totaux.nb_sousfacture)} color="amber"  />
            </div>

            {/* Filtres & recherche */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  {[
                    { key: 'tous',        label: `Tous (${resultats.length})` },
                    { key: 'ok',          label: `OK (${totaux.nb_ok})` },
                    { key: 'surfacture',  label: `Surfacturation (${totaux.nb_surfacture})` },
                    { key: 'sousfacture', label: `Sous-facturation (${totaux.nb_sousfacture})` },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setFiltre(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        filtre === key
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Rechercher plaque ou client…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="ml-auto border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 w-56"
                />
              </div>
            </div>

            {/* Tableau */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">
                  Détail du rapprochement
                  <span className="ml-2 text-slate-400 font-normal text-sm">
                    {lignesFiltrees.length} ligne{lignesFiltrees.length > 1 ? 's' : ''}
                  </span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Client</th>
                      <th className="px-4 py-3 text-left">Plaque</th>
                      <th className="px-4 py-3 text-right">Passages facturés</th>
                      <th className="px-4 py-3 text-right">Passages péage</th>
                      <th className="px-4 py-3 text-right">Écart</th>
                      <th className="px-4 py-3 text-right">Montant facturé (FCFA)</th>
                      <th className="px-4 py-3 text-left">Gares péage</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignesFiltrees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                          Aucune ligne correspondant aux filtres
                        </td>
                      </tr>
                    ) : lignesFiltrees.map((r, i) => {
                      const cfg = STATUT_CONFIG[r.statut] || STATUT_CONFIG.ok;
                      const ecartSign = r.ecart > 0 ? '+' : '';
                      return (
                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${
                          r.statut === 'surfacture'  ? 'bg-red-50/40'   :
                          r.statut === 'sousfacture' ? 'bg-amber-50/40' : ''
                        }`}>
                          <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate">
                            {r.client}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {r.plaque}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {fmt(r.passages_factures)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {r.passages_peage > 0 ? fmt(r.passages_peage) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${
                            r.ecart > 0 ? 'text-red-600' :
                            r.ecart < 0 ? 'text-amber-600' :
                            'text-emerald-600'
                          }`}>
                            {r.ecart !== 0 ? `${ecartSign}${fmt(r.ecart)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {r.montant_facture > 0 ? fmt(Math.round(r.montant_facture)) : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">
                            {r.gares_peage}
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
                        <td colSpan={2} className="px-4 py-3">TOTAL</td>
                        <td className="px-4 py-3 text-right">
                          {fmt(lignesFiltrees.reduce((s, r) => s + r.passages_factures, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fmt(lignesFiltrees.reduce((s, r) => s + r.passages_peage, 0))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const e = lignesFiltrees.reduce((s, r) => s + r.ecart, 0);
                            return <span className={e > 0 ? 'text-red-300' : e < 0 ? 'text-amber-300' : 'text-emerald-300'}>
                              {(e > 0 ? '+' : '') + fmt(e)}
                            </span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {fmt(Math.round(lignesFiltrees.reduce((s, r) => s + r.montant_facture, 0)))}
                        </td>
                        <td colSpan={2} className="px-4 py-3" />
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
