
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ Guard : si env manquant, on stoppe avec un message clair
if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] Variables d'environnement manquantes. Vérifie ton .env : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY"
  );
  throw new Error(
    "Supabase env manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // ✅ nécessaire pour PASSWORD_RECOVERY / magic links
  },
});
