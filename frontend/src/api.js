// En production (Vercel multi-service), VITE_API_BASE = "/_/backend"
// En dev local, variable absente → chaîne vide → proxy Vite prend le relais
export const API = import.meta.env.VITE_API_BASE ?? '';
