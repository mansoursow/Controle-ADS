import React, { useState, useRef } from 'react';
import { API } from '../api';

function base64ToBlobUrl(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
}

const BATCH_SIZE = 30;
const UPLOAD_CHUNK_SIZE = 500;

export default function AuditPage({ onBack }) {
  const [csvFile, setCsvFile]         = useState(null);
  const [photos, setPhotos]           = useState([]);
  const [sampleSize, setSampleSize]   = useState(0);
  const [results, setResults]         = useState([]);
  const [noImageRows, setNoImageRows] = useState([]);
  const [showNoImage, setShowNoImage] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [selectedImg, setSelectedImg] = useState(null);
  const [progress, setProgress]       = useState(0);
  const [logs, setLogs]               = useState([]);
  const [totals, setTotals]           = useState({ with: 0, without: 0 });

  const abortControllerRef = useRef(null);
  const blobUrlsRef        = useRef([]);
  const pendingResultsRef  = useRef([]);

  const addLog = (msg) =>
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  const clearPreviousRun = () => {
    blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    blobUrlsRef.current      = [];
    pendingResultsRef.current = [];
    setResults([]);
    setNoImageRows([]);
    setShowNoImage(false);
    setLogs([]);
    setProgress(0);
    setTotals({ with: 0, without: 0 });
  };

  const flushResults = () => {
    if (!pendingResultsRef.current.length) return;
    const batch = [...pendingResultsRef.current];
    pendingResultsRef.current = [];
    setResults(prev => [...prev, ...batch]);
  };

  const processStream = async (res, receivedCountRef, totalWithRef) => {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'info') {
            setTotals(prev => ({ with: prev.with + event.total_with_img, without: prev.without + event.total_without_img }));
            addLog(`📊 Batch: ${event.total_with_img} avec photo | ${event.total_without_img} sans photo`);
          } else if (event.type === 'result') {
            const item = event.data;
            receivedCountRef.current++;
            if (item.image_data) {
              item.image_url = base64ToBlobUrl(item.image_data);
              blobUrlsRef.current.push(item.image_url);
              delete item.image_data;
            }
            pendingResultsRef.current.push(item);
            if (pendingResultsRef.current.length >= BATCH_SIZE) flushResults();
            setProgress(Math.min(Math.round(receivedCountRef.current / totalWithRef.current * 100), 99));
            addLog(`🔍 [${receivedCountRef.current}] ${item.id} — IA: ${item.categorie_ia} | Écart: ${item.ecart} FCFA`);
          } else if (event.type === 'no_image_rows') {
            setNoImageRows(prev => [...prev, ...event.data]);
            addLog(`📋 +${event.data.length} lignes sans photo.`);
          } else if (event.type === 'error') {
            addLog(`❌ Erreur serveur : ${event.message}`);
          }
        } catch { /* chunk incomplet */ }
      }
    }
  };

  const handleUpload = async () => {
    if (!csvFile || photos.length === 0) return alert('Sélectionnez les fichiers.');
    clearPreviousRun();
    setLoading(true);
    addLog("🚀 Démarrage de l'audit...");
    abortControllerRef.current = new AbortController();

    const allPhotos = sampleSize > 0 ? Array.from(photos).slice(0, sampleSize) : Array.from(photos);
    const chunks = [];
    for (let i = 0; i < allPhotos.length; i += UPLOAD_CHUNK_SIZE)
      chunks.push(allPhotos.slice(i, i + UPLOAD_CHUNK_SIZE));

    const receivedCountRef = { current: 0 };
    const totalWithRef     = { current: allPhotos.length };

    try {
      addLog(`📁 ${allPhotos.length} photos → ${chunks.length} envoi(s)...`);
      for (let ci = 0; ci < chunks.length; ci++) {
        if (abortControllerRef.current.signal.aborted) break;
        addLog(`📤 Batch ${ci + 1}/${chunks.length} (${chunks[ci].length} photos)...`);
        const formData = new FormData();
        formData.append('file', csvFile);
        formData.append('is_last_chunk', ci === chunks.length - 1 ? 'true' : 'false');
        formData.append('chunk_index', String(ci));
        for (const p of chunks[ci]) formData.append('images', p);
        const res = await fetch(`${API}/audit`, { method: 'POST', body: formData, signal: abortControllerRef.current.signal });
        if (!res.ok) throw new Error(`Batch ${ci + 1} — HTTP ${res.status}`);
        await processStream(res, receivedCountRef, totalWithRef);
      }
      flushResults();
      addLog(`✅ Audit terminé — ${receivedCountRef.current} analysées IA.`);
      setProgress(100);
    } catch (err) {
      addLog(err.name === 'AbortError' ? '⚠️ Audit annulé.' : `❌ ERREUR : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const ecartTotal = results.reduce((s, r) => s + (r.ecart < 0 ? r.ecart : 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors px-4 py-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200">
            ← Accueil
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800">
              🔍 Audit <span className="text-blue-600">IA</span>
            </h1>
            <p className="text-slate-500 text-xs uppercase tracking-widest mt-1">
              Contrôle par photo — Classification C1–C4 — Détection d'écarts
            </p>
          </div>
        </div>

        {/* Import */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-4 uppercase">1. Import CSV</label>
            <input type="file" accept=".csv"
              onChange={e => setCsvFile(e.target.files[0])}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-4 uppercase">2. Dossier Photos Sortie</label>
            <input type="file" webkitdirectory="true" multiple
              onChange={e => setPhotos(e.target.files)}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-amber-50 file:text-amber-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Échantillon */}
        {photos.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4 flex items-center gap-4 flex-wrap">
            <span className="text-sm font-bold text-slate-700 uppercase">Échantillon :</span>
            {[0, 50, 100, 250, 500].map(n => (
              <button key={n} onClick={() => setSampleSize(n)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${sampleSize === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                {n === 0 ? `Toutes (${photos.length})` : `${n} premières`}
              </button>
            ))}
            <input type="number" min="1" max={photos.length} placeholder="Autre..."
              value={sampleSize > 0 && ![50,100,250,500].includes(sampleSize) ? sampleSize : ''}
              onChange={e => setSampleSize(Number(e.target.value) || 0)}
              className="w-28 px-3 py-1.5 rounded-full border border-slate-300 text-sm text-slate-700 focus:outline-none focus:border-blue-400"
            />
            {sampleSize > 0 && <span className="text-xs text-amber-600 font-semibold">⚡ {sampleSize} / {photos.length}</span>}
          </div>
        )}

        {/* Bouton */}
        <button
          onClick={loading ? () => abortControllerRef.current?.abort() : handleUpload}
          className={`w-full mb-4 py-4 rounded-xl font-bold text-white shadow-lg text-lg transition-all ${loading ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {loading ? "⛔ Annuler l'audit" : "Lancer l'Audit Comparatif"}
        </button>

        {/* Progress */}
        <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Compteurs */}
        {(totals.with > 0 || totals.without > 0) && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-slate-200 text-center shadow-sm">
              <p className="text-2xl font-black text-blue-600">{totals.with}</p>
              <p className="text-xs text-slate-500 uppercase font-bold mt-1">Avec photo</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 text-center shadow-sm">
              <p className="text-2xl font-black text-slate-400">{totals.without}</p>
              <p className="text-xs text-slate-500 uppercase font-bold mt-1">Sans photo</p>
            </div>
            <div className={`rounded-xl p-4 border text-center shadow-sm ${ecartTotal < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-2xl font-black ${ecartTotal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {ecartTotal.toLocaleString()} FCFA
              </p>
              <p className="text-xs text-slate-500 uppercase font-bold mt-1">Déficit total</p>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="mb-8 bg-slate-900 rounded-xl p-4 font-mono text-[10px] text-slate-300 h-24 overflow-y-auto shadow-inner">
          {logs.length === 0
            ? <p className="text-slate-600 italic">En attente de fichiers...</p>
            : logs.map((log, i) => <p key={i}>{log}</p>)}
        </div>

        {/* Tableau résultats */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-6">
          <div className="bg-slate-800 px-6 py-3">
            <h2 className="text-white font-black text-sm uppercase tracking-wider">
              Transactions analysées par IA ({results.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-700 text-white text-[10px] font-black uppercase">
                <tr>
                  <th className="p-4">Photo</th>
                  <th className="p-4">N° Transaction</th>
                  <th className="p-4">Date Sortie</th>
                  <th className="p-4">Trajet</th>
                  <th className="p-4">Payé</th>
                  <th className="p-4">Cl. Péagiste</th>
                  <th className="p-4">Cl. Sortie</th>
                  <th className="p-4">IA</th>
                  <th className="p-4">Prix Dû</th>
                  <th className="p-4">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.length === 0 && !loading && (
                  <tr><td colSpan="10" className="p-10 text-center text-slate-400 italic">Aucune donnée — lancez un audit</td></tr>
                )}
                {results.map((r, i) => (
                  <tr key={i} className={`text-sm transition-colors ${r.ecart < 0 ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                    <td className="p-4">
                      {r.image_url && (
                        <img src={r.image_url} className="w-20 h-12 object-cover rounded shadow-sm cursor-zoom-in hover:scale-105 transition-transform"
                          onClick={() => setSelectedImg(r.image_url)} alt="Véhicule" />
                      )}
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">{r.id || '—'}</td>
                    <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{r.date_sortie || '—'}</td>
                    <td className="p-4">
                      <div className="text-[10px] text-slate-400 uppercase">De: {r.gare_entree}</div>
                      <div className="font-bold text-xs">Vers: {r.gare_sortie}</div>
                    </td>
                    <td className="p-4 font-bold text-sm">{r.classe_agent}</td>
                    <td className="p-4"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-black border border-slate-300">{r.classe_facturee || '—'}</span></td>
                    <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-black border border-purple-200">{r.classe_sortie || '—'}</span></td>
                    <td className="p-4"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-black border border-blue-200">{r.categorie_ia}</span></td>
                    <td className="p-4 text-slate-600 font-medium text-sm">{r.prix_theorique}</td>
                    <td className={`p-4 font-black text-sm ${r.ecart < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {r.ecart} FCFA
                      {r.ecart < 0 && <span className="ml-2 text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">DÉFICIT</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Toggle sans photo */}
        {noImageRows.length > 0 && (
          <button onClick={() => setShowNoImage(v => !v)}
            className="w-full mb-4 py-3 rounded-xl font-bold text-slate-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all">
            {showNoImage ? `▲ Masquer les lignes sans photo (${noImageRows.length})` : `▼ Afficher les lignes sans photo (${noImageRows.length})`}
          </button>
        )}

        {showNoImage && noImageRows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-amber-200 overflow-hidden mb-6">
            <div className="bg-amber-600 px-6 py-3">
              <h2 className="text-white font-black text-sm uppercase tracking-wider">
                Lignes sans photo — non vérifiées par IA ({noImageRows.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-amber-50 text-amber-900 text-[10px] font-black uppercase">
                  <tr>
                    <th className="p-4">N° Transaction</th>
                    <th className="p-4">Trajet</th>
                    <th className="p-4">Montant déclaré</th>
                    <th className="p-4">Classe déclarée</th>
                    <th className="p-4">Date sortie</th>
                    <th className="p-4">Photo attendue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-50">
                  {noImageRows.map((r, i) => (
                    <tr key={i} className="text-sm hover:bg-amber-50 transition-colors">
                      <td className="p-4 font-mono text-xs text-slate-600">{r.id}</td>
                      <td className="p-4">
                        <div className="text-[10px] text-slate-400 uppercase">De: {r.gare_entree}</div>
                        <div className="font-bold text-xs">Vers: {r.gare_sortie}</div>
                      </td>
                      <td className="p-4 font-bold">{r.classe_agent}</td>
                      <td className="p-4"><span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-black border border-amber-200">{r.classe_facturee}</span></td>
                      <td className="p-4 text-xs text-slate-500">{r.date_sortie}</td>
                      <td className="p-4 text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={r.photo_attendue}>
                        {r.photo_attendue.split('/').pop() || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal image */}
      {selectedImg && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImg(null)}>
          <div className="relative">
            <button className="absolute -top-10 right-0 text-white text-2xl font-bold">&times; Fermer</button>
            <img src={selectedImg} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border-4 border-white/10" alt="Vue agrandie" />
          </div>
        </div>
      )}
    </div>
  );
}
