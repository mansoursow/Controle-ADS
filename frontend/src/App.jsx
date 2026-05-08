import React, { useState } from 'react';
import AuditPage from './pages/AuditPage';
import RecettesPage from './pages/RecettesPage';
import PostPaidPage from './pages/PostPaidPage';

function HomePage({ onNavigate }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-extrabold text-white tracking-tight mb-3">
          ADS <span className="text-blue-400">& ADOC</span>
        </h1>
        <p className="text-slate-400 uppercase text-sm tracking-widest font-medium">
          Réseau Autoroutier du Sénégal — Plateforme de Contrôle
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        {/* Audit IA */}
        <button
          onClick={() => onNavigate('audit')}
          className="group bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-500 rounded-3xl p-10 text-left transition-all duration-300 shadow-2xl hover:shadow-blue-900/40 hover:-translate-y-1"
        >
          <div className="text-5xl mb-6">🔍</div>
          <h2 className="text-2xl font-extrabold text-white mb-3">Audit Catégorie</h2>
          <p className="text-slate-400 group-hover:text-blue-100 text-sm leading-relaxed transition-colors">
            Contrôle des transactions par analyse photo. Détection automatique des véhicules,
            classification C1–C4 et calcul des écarts de recettes.
          </p>
          <div className="mt-8 flex items-center gap-2 text-blue-400 group-hover:text-white font-bold text-sm transition-colors">
            Lancer le contrôle <span className="text-lg">→</span>
          </div>
        </button>

        {/* Analyse Recettes */}
        <button
          onClick={() => onNavigate('recettes')}
          className="group bg-white/5 hover:bg-emerald-600 border border-white/10 hover:border-emerald-500 rounded-3xl p-10 text-left transition-all duration-300 shadow-2xl hover:shadow-emerald-900/40 hover:-translate-y-1"
        >
          <div className="text-5xl mb-6">📊</div>
          <h2 className="text-2xl font-extrabold text-white mb-3">Analyse des Recettes</h2>
          <p className="text-slate-400 group-hover:text-emerald-100 text-sm leading-relaxed transition-colors">
            Agrégation des données de gares (2021–2025) par jour, mois ou année.
            Comparaison automatique avec les rapports d'exploitation.
          </p>
          <div className="mt-8 flex items-center gap-2 text-emerald-400 group-hover:text-white font-bold text-sm transition-colors">
            Lancer l'analyse <span className="text-lg">→</span>
          </div>
        </button>

        {/* Contrôle Post Paid */}
        <button
          onClick={() => onNavigate('postpaid')}
          className="group bg-white/5 hover:bg-violet-600 border border-white/10 hover:border-violet-500 rounded-3xl p-10 text-left transition-all duration-300 shadow-2xl hover:shadow-violet-900/40 hover:-translate-y-1"
        >
          <div className="text-5xl mb-6">💳</div>
          <h2 className="text-2xl font-extrabold text-white mb-3">Contrôle Post Paid</h2>
          <p className="text-slate-400 group-hover:text-violet-100 text-sm leading-relaxed transition-colors">
            Rapprochement des passages péage réels avec les factures des clients
            post-paid. Détection des surfacturations et sous-facturations par plaque.
          </p>
          <div className="mt-8 flex items-center gap-2 text-violet-400 group-hover:text-white font-bold text-sm transition-colors">
            Lancer le contrôle <span className="text-lg">→</span>
          </div>
        </button>
      </div>

      <p className="mt-16 text-slate-600 text-xs">
        ADOC — Contrôle & Audit des Péages — Sénégal
      </p>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('home');

  if (page === 'audit')    return <AuditPage    onBack={() => setPage('home')} />;
  if (page === 'recettes') return <RecettesPage onBack={() => setPage('home')} />;
  if (page === 'postpaid') return <PostPaidPage onBack={() => setPage('home')} />;
  return <HomePage onNavigate={setPage} />;
}
