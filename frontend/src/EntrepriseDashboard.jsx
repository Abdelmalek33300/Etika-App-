import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

/**
 * EntrepriseDashboard.jsx — UX refonte (Option B, couleurs) + auth stable conservée
 * - 2 états : NON CONNECTÉ / CONNECTÉ
 * - Point d’entrée cohérent : Salle publique (mosaïque) -> login -> espace privé
 * - Connexion / Déconnexion Supabase Auth (stabilité conservée)
 * - Mes enchères = uniquement candidatures liées à auction_candidates.user_id
 */

export default function EntrepriseDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // ===== FORM LOGIN =====
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // ===== DATA =====
  const [candidatures, setCandidatures] = useState([]);

  const userEmail = session?.user?.email || "";
  const displayName = useMemo(() => {
    const md = session?.user?.user_metadata || {};
    return md.company_name || md.companyName || md.name || "Entreprise";
  }, [session]);

  // =============================
  // SESSION (boot + listener)
  // =============================
  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(session || null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Supabase source de vérité
      setSession(newSession || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // =============================
  // RESET FORM SI DÉCONNECTÉ
  // =============================
  useEffect(() => {
    if (!session) {
      setEmail("");
      setPassword("");
      setAuthError("");
      setAuthBusy(false);
    }
  }, [session]);

  // =============================
  // LOAD MES ENCHÈRES UNIQUEMENT
  // =============================
  useEffect(() => {
    if (!session?.user?.id) {
      setCandidatures([]);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("auction_candidates")
        .select(
          `
          id,
          auction_id,
          company_name,
          created_at,
          auctions:auction_id (
            id,
            sector,
            title,
            status
          )
        `
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("load candidatures error:", error);
        setCandidatures([]);
        return;
      }

      setCandidatures(data || []);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // =============================
  // LOGIN (conservé + UX)
  // =============================
  async function handleLogin(e) {
    e.preventDefault();
    if (authBusy) return;

    setAuthError("");

    const cleanEmail = (email || "").trim();

    if (!cleanEmail || !password) {
      setAuthError("Email et mot de passe requis.");
      return;
    }

    setAuthBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      // Re-synchronise la session immédiatement (évite les états “flous”)
      const {
        data: { session: freshSession },
      } = await supabase.auth.getSession();
      setSession(freshSession || null);

      // Route existante conservée
      navigate("/entreprise/encheres", { replace: true });
    } catch (err) {
      setAuthError(err?.message || "Connexion impossible.");
    } finally {
      setAuthBusy(false);
    }
  }

  // =============================
  // LOGOUT (conservé)
  // =============================
  async function handleLogout() {
    if (authBusy) return;
    setAuthBusy(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn("Logout warning:", error);

      const {
        data: { session: freshSession },
      } = await supabase.auth.getSession();

      setSession(freshSession || null);
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      // Nettoyage UI immédiat
      setSession(null);
      setCandidatures([]);
      setAuthError("");
      setEmail("");
      setPassword("");

      navigate("/entreprise", { replace: true });
      setAuthBusy(false);
    }
  }

  // =============================
  // UI styles (couleurs + cartes)
  // =============================
  const styles = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0b1220 0%, #0b1220 35%, #070b13 100%)",
      color: "#EAF0FF",
      padding: "22px 14px 48px",
      fontFamily:
        'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    },
    container: {
      maxWidth: 1100,
      margin: "0 auto",
    },
    topbar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "14px 16px",
      borderRadius: 16,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.10)",
      backdropFilter: "blur(8px)",
    },
    brand: { display: "flex", alignItems: "center", gap: 10, fontWeight: 900, letterSpacing: 0.4 },
    dot: { width: 10, height: 10, borderRadius: 999, background: "#38bdf8", display: "inline-block" },
    badge: {
      fontSize: 12,
      padding: "4px 10px",
      borderRadius: 999,
      background: "rgba(56, 189, 248, 0.18)",
      border: "1px solid rgba(56, 189, 248, 0.35)",
      color: "#BDEBFF",
      fontWeight: 800,
    },
    nav: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" },
    btn: {
      cursor: "pointer",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.08)",
      color: "#EAF0FF",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    btnPrimary: {
      border: "1px solid rgba(34, 197, 94, 0.35)",
      background: "linear-gradient(90deg, rgba(34,197,94,0.25), rgba(16,185,129,0.18))",
    },
    btnAccent: {
      border: "1px solid rgba(99, 102, 241, 0.35)",
      background: "linear-gradient(90deg, rgba(99,102,241,0.25), rgba(56,189,248,0.16))",
    },
    hero: {
      marginTop: 16,
      padding: "26px 18px",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.10)",
      background:
        "radial-gradient(1100px 420px at 18% 0%, rgba(99,102,241,0.22) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.02) 100%)",
    },
    h1: { margin: 0, fontSize: 28, fontWeight: 950 },
    p: { margin: "10px 0 0", opacity: 0.92, lineHeight: 1.55, maxWidth: 820 },

    grid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 },
    card: {
      borderRadius: 18,
      padding: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.06)",
    },
    cardTitle: { margin: 0, fontSize: 16, fontWeight: 950 },
    cardText: { margin: "8px 0 0", opacity: 0.9, lineHeight: 1.5 },

    stepsWrap: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 14 },
    step: {
      borderRadius: 18,
      padding: 14,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.05)",
    },
    stepNum: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: 10,
      fontWeight: 950,
      background: "rgba(56,189,248,0.16)",
      border: "1px solid rgba(56,189,248,0.30)",
      color: "#C9F2FF",
    },

    form: { display: "grid", gap: 10, marginTop: 12, maxWidth: 420 },
    input: {
      padding: "12px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(0,0,0,0.18)",
      color: "#EAF0FF",
      outline: "none",
    },
    error: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 14,
      background: "rgba(239, 68, 68, 0.14)",
      border: "1px solid rgba(239, 68, 68, 0.25)",
      color: "#FFD6D6",
      fontWeight: 900,
    },
    info: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 14,
      background: "rgba(34, 197, 94, 0.12)",
      border: "1px solid rgba(34, 197, 94, 0.25)",
      color: "#D9FFE8",
      fontWeight: 900,
    },

    list: { marginTop: 10, display: "grid", gap: 10 },
    row: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: 12,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
    },
    rowLeft: { display: "grid", gap: 4 },
    rowTitle: { fontWeight: 950 },
    rowMeta: { fontSize: 12, opacity: 0.85 },
    small: { fontSize: 12, opacity: 0.85 },
  };

  const responsiveHint = (
    <style>{`
      @media (max-width: 900px) {
        .steps3 { grid-template-columns: 1fr !important; }
        .grid12 { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );

  // =============================
  // UI
  // =============================
  if (loading) return <div style={{ padding: 40 }}>Chargement…</div>;

  return (
    <div style={styles.page}>
      {responsiveHint}
      <div style={styles.container}>
        {/* TOPBAR */}
        <div style={styles.topbar}>
          <div style={styles.brand}>
            <span style={styles.dot} />
            <span>ALLIANCE</span>
            <span style={styles.badge}>ENCHÈRES</span>
          </div>

          <div style={styles.nav}>
            <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
              Voir les enchères
            </Link>

            {session ? (
              <>
                <span style={styles.small}>
                  Connecté : <b>{displayName}</b>
                </span>
                <button onClick={handleLogout} type="button" disabled={authBusy} style={styles.btn}>
                  {authBusy ? "Déconnexion…" : "Déconnexion"}
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={() => {
                  const el = document.getElementById("entreprise-login-email");
                  if (el) el.focus();
                }}
              >
                Connexion entreprise
              </button>
            )}
          </div>
        </div>

        {/* =============================
            ÉTAT NON CONNECTÉ (Option B)
        ============================= */}
        {!session && (
          <>
            <div style={styles.hero}>
              <h1 style={styles.h1}>Espace entreprise</h1>
              <p style={styles.p}>
                Devenez sponsor officiel dans votre secteur et accédez à une communauté de consommateurs engagés.
                La salle des enchères est publique — votre espace entreprise est disponible après connexion.
              </p>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
                  Explorer la mosaïque publique
                </Link>
                <a href="#connexion" style={{ ...styles.btn, ...styles.btnPrimary }}>
                  Se connecter
                </a>
              </div>

              {/* 3 étapes (Option B) */}
              <div className="steps3" style={styles.stepsWrap}>
                <div style={styles.step}>
                  <div style={styles.stepNum}>1</div>
                  <h3 style={{ margin: "10px 0 0", fontWeight: 950 }}>Créez votre compte</h3>
                  <p style={{ margin: "6px 0 0", opacity: 0.9, lineHeight: 1.45 }}>
                    Identifiez votre entreprise et sécurisez votre accès.
                  </p>
                </div>
                <div style={styles.step}>
                  <div style={styles.stepNum}>2</div>
                  <h3 style={{ margin: "10px 0 0", fontWeight: 950 }}>Candidatez par secteur</h3>
                  <p style={{ margin: "6px 0 0", opacity: 0.9, lineHeight: 1.45 }}>
                    Positionnez-vous sur les enchères qui correspondent à vos catégories.
                  </p>
                </div>
                <div style={styles.step}>
                  <div style={styles.stepNum}>3</div>
                  <h3 style={{ margin: "10px 0 0", fontWeight: 950 }}>Participez aux enchères</h3>
                  <p style={{ margin: "6px 0 0", opacity: 0.9, lineHeight: 1.45 }}>
                    Placez vos offres et suivez vos candidatures dans votre tableau de bord.
                  </p>
                </div>
              </div>

              {/* Bloc confiance */}
              <div style={{ ...styles.card, marginTop: 12 }}>
                <h3 style={styles.cardTitle}>Confiance & transparence</h3>
                <p style={styles.cardText}>
                  ✔ Plateforme sécurisée · ✔ Comptes vérifiés · ✔ Processus transparent · ✔ Données protégées
                </p>
              </div>

              {/* Form login */}
              <div id="connexion" style={{ ...styles.card, marginTop: 12 }}>
                <h3 style={styles.cardTitle}>Connexion entreprise</h3>
                <p style={{ ...styles.cardText, maxWidth: 650 }}>
                  Connectez-vous pour accéder à votre espace privé (vos enchères, vos candidatures, vos actions).
                </p>

                <form onSubmit={handleLogin} autoComplete="on" style={styles.form}>
                  <input
                    id="entreprise-login-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    style={styles.input}
                  />

                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Mot de passe"
                    autoComplete="current-password"
                    style={styles.input}
                  />

                  <button disabled={authBusy} type="submit" style={{ ...styles.btn, ...styles.btnPrimary }}>
                    {authBusy ? "Connexion…" : "Se connecter"}
                  </button>

                  {authError && <div style={styles.error}>⚠️ {authError}</div>}
                </form>

                <p style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                  Le navigateur gère ses suggestions. Aucun compte test interne n’est affiché.
                </p>
              </div>
            </div>
          </>
        )}

        {/* =============================
            ÉTAT CONNECTÉ (Dashboard métier)
        ============================= */}
        {session && (
          <>
            <div style={styles.hero}>
              <h1 style={styles.h1}>Tableau de bord entreprise</h1>
              <p style={styles.p}>
                Bienvenue <b>{displayName}</b>. Accédez rapidement à vos enchères et à vos actions.
              </p>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
                  Voir les enchères publiques
                </Link>
                <Link to="/entreprise/encheres" style={{ ...styles.btn, ...styles.btnPrimary }}>
                  Mes enchères (page dédiée)
                </Link>
              </div>

              <div style={{ marginTop: 10, opacity: 0.8, fontSize: 12 }}>
                Compte : <b>{userEmail}</b>
              </div>
            </div>

            <div className="grid12" style={styles.grid}>
              {/* MES ENCHÈRES */}
              <div style={{ ...styles.card, gridColumn: "span 7" }}>
                <h3 style={styles.cardTitle}>Mes enchères</h3>
                <p style={styles.cardText}>
                  Vos candidatures (liées à votre compte). Accès direct à “Enchérir”.
                </p>

                {candidatures.length === 0 && (
                  <div style={styles.info}>
                    Aucune enchère pour le moment. Explorez les enchères publiques puis candidatez.
                  </div>
                )}

                {candidatures.length > 0 && (
                  <div style={styles.list}>
                    {candidatures.map((c) => (
                      <div key={c.id} style={styles.row}>
                        <div style={styles.rowLeft}>
                          <div style={styles.rowTitle}>
                            {c.auctions?.sector || "Secteur"} — {c.auctions?.title || "Enchère"}
                          </div>
                          <div style={styles.rowMeta}>
                            Statut : {c.auctions?.status || "—"}
                            {c.company_name ? ` · Candidat : ${c.company_name}` : ""}
                          </div>
                        </div>

                        {/* Route existante conservée */}
                        <Link to={`/entreprise/encherir/${c.auction_id}`} style={{ ...styles.btn, ...styles.btnPrimary }}>
                          Enchérir →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ACTION RAPIDE */}
              <div style={{ ...styles.card, gridColumn: "span 5" }}>
                <h3 style={styles.cardTitle}>Participer à une enchère</h3>
                <p style={styles.cardText}>
                  Ouvrez la mosaïque publique, repérez une enchère, puis candidatez et enchérissez depuis votre espace.
                </p>

                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
                    Ouvrir la mosaïque des enchères
                  </Link>

                  <Link to="/entreprise/encheres" style={styles.btn}>
                    Aller à “Mes enchères”
                  </Link>
                </div>

                <div style={{ ...styles.card, marginTop: 12, background: "rgba(99,102,241,0.12)" }}>
                  <h4 style={{ margin: 0, fontWeight: 950 }}>Rappel</h4>
                  <p style={{ margin: "8px 0 0", opacity: 0.9, lineHeight: 1.45 }}>
                    Le public voit la salle des enchères.
                    <br />
                    Votre dashboard est privé et orienté “action”.
                  </p>
                </div>

                <button onClick={handleLogout} type="button" disabled={authBusy} style={{ ...styles.btn, marginTop: 12 }}>
                  {authBusy ? "Déconnexion…" : "Déconnexion"}
                </button>
              </div>

              {/* (FUTUR) NOTIFICATIONS */}
              <div style={{ ...styles.card, gridColumn: "span 12" }}>
                <h3 style={styles.cardTitle}>Notifications (à venir)</h3>
                <p style={styles.cardText}>
                  Exemple : “Vous êtes en tête”, “Surenchère détectée”, “Nouvelle enchère disponible”.
                  <br />
                  Pour l’instant : priorité à l’UX claire + parcours sans friction.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}