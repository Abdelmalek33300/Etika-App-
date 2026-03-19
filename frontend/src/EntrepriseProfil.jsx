import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, padding: "10px 0" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{label}</div>
      <div style={{ color: "#0f172a", fontWeight: 900, lineHeight: 1.4 }}>{value ?? "—"}</div>
    </div>
  );
}

function StatusBadge({ verified }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid transparent",
  };
  if (verified) return <span style={{ ...base, background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }}>Vérifiée</span>;
  return <span style={{ ...base, background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" }}>En attente</span>;
}

export default function EntrepriseProfil({ session }) {
  const uid = session?.user?.id;
  const email = useMemo(() => session?.user?.email || "", [session]);

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) return;

    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const { data, error: e } = await supabase
          .from("company_accounts")
          .select("company_name, is_verified")
          .eq("user_id", uid)
          .maybeSingle();

        if (e) throw e;
        if (!mounted) return;

        setRow(data || null);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Erreur lors du chargement du profil entreprise.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [uid]);

  const companyName = loading ? "…" : row?.company_name || "—";
  const isVerified = loading ? false : !!row?.is_verified;

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>Mon profil</h1>
      <p style={{ margin: "6px 0 0 0", color: "#475569", lineHeight: 1.5 }}>
        Espace <b>privé</b> (lecture). La candidature et les mises se font uniquement dans la <b>Salle des enchères</b>.
      </p>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#9f1239",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 14,
          boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
          maxWidth: 760,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Identité & statut</h2>

        <div style={{ marginTop: 10 }}>
          <InfoRow label="Email" value={email} />
          <InfoRow label="Nom entreprise" value={companyName} />
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, padding: "10px 0" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Statut</div>
            <div style={{ color: "#0f172a", fontWeight: 900 }}>
              {loading ? "…" : <StatusBadge verified={isVerified} />}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 10, color: "#64748b", fontWeight: 800, fontSize: 13 }}>
          Plus tard : représentant légal, coordonnées, documents (KBIS ou équivalent), vérifications.
        </div>
      </div>

      <style>{`
        @media (max-width: 720px){
          div[style*="grid-template-columns: 180px 1fr"]{ grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}