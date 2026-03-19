import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";

function eurFromCents(cents) {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function toCentsFromEuroInput(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * EntrepriseEncherir.jsx — UX harmonisée (même identité que le dashboard)
 * - /entreprise/encheres : liste privée = UNIQUEMENT les enchères où l'entreprise est candidate
 * - /entreprise/encherir/:auctionId : écran enchérir pour une enchère précise (si candidate)
 *
 * Tables:
 * - auction_candidates: id, auction_id, company_name, created_at, user_id
 * - auctions: id, sector, title, status
 * - auction_bids: id, auction_id, candidate_id, bidder_user_id, amount_cents, created_at
 */

export default function EntrepriseEncherir() {
  const { auctionId } = useParams();

  const [bootLoading, setBootLoading] = useState(true);
  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Liste "mes enchères" (candidatures)
  const [candidatures, setCandidatures] = useState([]);

  // Agrégats bids par enchère
  const [bestByAuction, setBestByAuction] = useState({});
  const [myBestByAuction, setMyBestByAuction] = useState({});

  // inputs (montant) par enchère
  const [amountByAuction, setAmountByAuction] = useState({});
  const [busyByAuction, setBusyByAuction] = useState({});

  const userId = session?.user?.id || null;
  const userEmail = session?.user?.email || "";
  const displayName = useMemo(() => {
    const md = session?.user?.user_metadata || {};
    return md.company_name || md.companyName || md.name || "Entreprise";
  }, [session]);

  // =============================
  // BOOT SESSION
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
      } catch (e) {
        // rien
      } finally {
        if (!mounted) return;
        setBootLoading(false);
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // =============================
  // LOAD "MES ENCHÈRES" (UNIQUEMENT candidatures)
  // =============================
  useEffect(() => {
    if (!userId) {
      setCandidatures([]);
      setBestByAuction({});
      setMyBestByAuction({});
      setAuthMsg("Connexion requise");
      return;
    }

    let cancelled = false;

    async function loadMyAuctions() {
      setLoading(true);
      setErrorMsg("");
      setAuthMsg("");

      try {
        // 1) candidatures (mes candidatures)
        const { data: cand, error: candErr } = await supabase
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
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (candErr) throw candErr;

        const rows = cand || [];
        if (cancelled) return;

        setCandidatures(rows);

        // 2) si aucune candidature => rien à agréger
        const auctionIds = rows.map((r) => r.auction_id).filter(Boolean);
        if (auctionIds.length === 0) {
          setBestByAuction({});
          setMyBestByAuction({});
          return;
        }

        // 3) Récupération des bids uniquement sur ces enchères
        const { data: bids, error: bidsErr } = await supabase
          .from("auction_bids")
          .select("auction_id, bidder_user_id, amount_cents")
          .in("auction_id", auctionIds);

        if (bidsErr) throw bidsErr;

        if (cancelled) return;

        const best = {};
        const mine = {};
        for (const b of bids || []) {
          const aId = b.auction_id;
          const amt = b.amount_cents ?? 0;

          if (best[aId] === undefined || amt > best[aId]) best[aId] = amt;
          if (b.bidder_user_id === userId) {
            if (mine[aId] === undefined || amt > mine[aId]) mine[aId] = amt;
          }
        }

        setBestByAuction(best);
        setMyBestByAuction(mine);
      } catch (e) {
        console.error("loadMyAuctions error:", e);
        setErrorMsg(e?.message || "Erreur de chargement.");
        setCandidatures([]);
        setBestByAuction({});
        setMyBestByAuction({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMyAuctions();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // =============================
  // Mode "détail": retrouver la candidature correspondante
  // =============================
  const candidatureForDetail = useMemo(() => {
    if (!auctionId) return null;
    return candidatures.find((c) => String(c.auction_id) === String(auctionId)) || null;
  }, [auctionId, candidatures]);

  // =============================
  // Submit bid (logique conservée)
  // =============================
  async function submitBid({ auction_id, candidate_id }) {
    setErrorMsg("");

    const raw = amountByAuction[auction_id] ?? "";
    const cents = toCentsFromEuroInput(raw);

    if (!cents || cents <= 0) {
      setErrorMsg("Montant invalide.");
      return;
    }

    const currentBest = bestByAuction[auction_id] ?? 0;

    // si déjà leader (mon best == best)
    const myBest = myBestByAuction[auction_id] ?? null;
    const iAmLeader = myBest !== null && myBest === currentBest && currentBest > 0;
    if (iAmLeader) {
      setErrorMsg("Vous êtes déjà en tête : impossible de surenchérir sur vous-même.");
      return;
    }

    // doit être strictement au-dessus du best actuel
    if (cents <= currentBest) {
      setErrorMsg("Votre offre doit être supérieure à la meilleure offre actuelle.");
      return;
    }

    setBusyByAuction((m) => ({ ...m, [auction_id]: true }));

    try {
      const { error } = await supabase.from("auction_bids").insert([
        {
          auction_id,
          candidate_id,
          bidder_user_id: userId,
          amount_cents: cents,
        },
      ]);

      if (error) throw error;

      setAmountByAuction((m) => ({ ...m, [auction_id]: "" }));

      // Optimiste
      setBestByAuction((m) => ({ ...m, [auction_id]: Math.max(m[auction_id] ?? 0, cents) }));
      setMyBestByAuction((m) => ({ ...m, [auction_id]: Math.max(m[auction_id] ?? 0, cents) }));

      // Re-sync exact
      const { data: bids, error: bidsErr } = await supabase
        .from("auction_bids")
        .select("bidder_user_id, amount_cents")
        .eq("auction_id", auction_id);

      if (!bidsErr) {
        let best = 0;
        let mine = null;
        for (const b of bids || []) {
          const amt = b.amount_cents ?? 0;
          if (amt > best) best = amt;
          if (b.bidder_user_id === userId) {
            if (mine === null || amt > mine) mine = amt;
          }
        }
        setBestByAuction((m) => ({ ...m, [auction_id]: best }));
        setMyBestByAuction((m) => ({ ...m, [auction_id]: mine }));
      }
    } catch (e) {
      console.error("submitBid error:", e);
      setErrorMsg(e?.message || "Erreur: impossible d'enchérir.");
    } finally {
      setBusyByAuction((m) => ({ ...m, [auction_id]: false }));
    }
  }

  // =============================
  // Styles (même identité que dashboard)
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
    container: { maxWidth: 1100, margin: "0 auto" },
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
      padding: "22px 18px",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.10)",
      background:
        "radial-gradient(1100px 420px at 18% 0%, rgba(99,102,241,0.22) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.02) 100%)",
    },
    h1: { margin: 0, fontSize: 26, fontWeight: 950 },
    p: { margin: "10px 0 0", opacity: 0.92, lineHeight: 1.55, maxWidth: 900 },
    grid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 },
    card: {
      borderRadius: 18,
      padding: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.06)",
    },
    cardTitle: { margin: 0, fontSize: 16, fontWeight: 950 },
    cardText: { margin: "8px 0 0", opacity: 0.9, lineHeight: 1.5 },
    list: { marginTop: 12, display: "grid", gap: 10 },
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
    input: {
      padding: "11px 12px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(0,0,0,0.18)",
      color: "#EAF0FF",
      outline: "none",
      width: 170,
    },
    pillLeader: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(34, 197, 94, 0.14)",
      border: "1px solid rgba(34, 197, 94, 0.26)",
      color: "#D9FFE8",
      fontWeight: 900,
      fontSize: 12,
    },
    warn: {
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
    small: { fontSize: 12, opacity: 0.85 },
  };

  const responsiveHint = (
    <style>{`
      @media (max-width: 900px) {
        .grid12 { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );

  // =============================
  // UI components
  // =============================
  function AuctionRow({ candidature }) {
    const a = candidature?.auctions;
    const aId = candidature.auction_id;

    const best = bestByAuction[aId] ?? 0;
    const myBest = myBestByAuction[aId] ?? null;
    const iAmLeader = myBest !== null && myBest === best && best > 0;

    return (
      <div style={styles.row}>
        <div style={styles.rowLeft}>
          <div style={styles.rowTitle}>
            {a?.sector || "Secteur"} — {a?.title || "Enchère"}
          </div>

          <div style={styles.rowMeta}>
            Statut : {a?.status || "—"} · Meilleure offre : <b>{eurFromCents(best)}</b> · Votre meilleure mise :{" "}
            <b>{eurFromCents(myBest)}</b>
          </div>

          {iAmLeader && (
            <div style={{ marginTop: 6 }}>
              <span style={styles.pillLeader}>• Vous êtes en tête</span>
              <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.86 }}>
                (aucune surenchère sur vous-même)
              </span>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              value={amountByAuction[aId] ?? ""}
              onChange={(e) => setAmountByAuction((m) => ({ ...m, [aId]: e.target.value }))}
              placeholder="Montant €"
              inputMode="decimal"
              style={styles.input}
              disabled={iAmLeader || busyByAuction[aId]}
            />

            <button
              onClick={() => submitBid({ auction_id: aId, candidate_id: candidature.id })}
              disabled={iAmLeader || busyByAuction[aId]}
              style={{
                ...styles.btn,
                ...styles.btnPrimary,
                opacity: iAmLeader ? 0.55 : 1,
                cursor: iAmLeader ? "not-allowed" : "pointer",
              }}
            >
              {busyByAuction[aId] ? "…" : "Enchérir"}
            </button>
          </div>

          <Link to={`/entreprise/encherir/${aId}`} style={{ ...styles.btn, ...styles.btnAccent }}>
            Ouvrir →
          </Link>
        </div>
      </div>
    );
  }

  // =============================
  // RENDER
  // =============================
  if (bootLoading) return <div style={{ padding: 40 }}>Chargement…</div>;

  // Topbar (commune aux modes)
  const Topbar = (
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

        <Link to="/entreprise" style={styles.btn}>
          Tableau de bord
        </Link>

        {userId ? (
          <span style={styles.small}>
            <b>{displayName}</b> · {userEmail}
          </span>
        ) : (
          <span style={styles.small}>Non connecté</span>
        )}
      </div>
    </div>
  );

  // Si pas connecté => message clair, cohérent, sans “fourre-tout”
  if (!userId) {
    return (
      <div style={styles.page}>
        {responsiveHint}
        <div style={styles.container}>
          {Topbar}

          <div style={styles.hero}>
            <h1 style={styles.h1}>Accès privé — entreprise</h1>
            <p style={styles.p}>Cette page est réservée aux entreprises connectées.</p>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/entreprise" style={{ ...styles.btn, ...styles.btnPrimary }}>
                Aller à la connexion entreprise
              </Link>
              <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
                Retour à la salle publique
              </Link>
            </div>

            {authMsg && <div style={styles.info}>{authMsg}</div>}
          </div>
        </div>
      </div>
    );
  }

  // MODE DETAIL (/entreprise/encherir/:auctionId)
  if (auctionId) {
    // Accès refusé si non candidat
    if (!candidatureForDetail) {
      return (
        <div style={styles.page}>
          {responsiveHint}
          <div style={styles.container}>
            {Topbar}

            <div style={styles.hero}>
              <h1 style={styles.h1}>Enchérir</h1>
              <p style={styles.p}>
                Accès refusé : vous n’êtes pas candidat sur cette enchère (sécurité).
              </p>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link to="/entreprise/encheres" style={{ ...styles.btn, ...styles.btnPrimary }}>
                  Voir toutes mes enchères
                </Link>
                <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
                  Retour à la salle publique
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const a = candidatureForDetail.auctions;
    const aId = candidatureForDetail.auction_id;
    const best = bestByAuction[aId] ?? 0;
    const myBest = myBestByAuction[aId] ?? null;
    const iAmLeader = myBest !== null && myBest === best && best > 0;

    return (
      <div style={styles.page}>
        {responsiveHint}
        <div style={styles.container}>
          {Topbar}

          <div style={styles.hero}>
            <h1 style={styles.h1}>Enchérir</h1>
            <p style={styles.p}>
              {a?.sector || "Secteur"} — <b>{a?.title || "Enchère"}</b>
            </p>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/entreprise/encheres" style={styles.btn}>
                ← Retour à mes enchères
              </Link>
              <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
                Salle publique
              </Link>
            </div>

            <div style={{ ...styles.card, marginTop: 14 }}>
              <h3 style={styles.cardTitle}>Situation</h3>
              <p style={styles.cardText}>
                Meilleure offre actuelle : <b>{eurFromCents(best)}</b>
                {" · "}
                Votre meilleure mise : <b>{eurFromCents(myBest)}</b>
                {iAmLeader && (
                  <>
                    {" · "}
                    <span style={styles.pillLeader}>Vous êtes en tête</span>
                  </>
                )}
              </p>

              {errorMsg && <div style={styles.warn}>⚠️ {errorMsg}</div>}

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={amountByAuction[aId] ?? ""}
                  onChange={(e) => setAmountByAuction((m) => ({ ...m, [aId]: e.target.value }))}
                  placeholder="Montant €"
                  inputMode="decimal"
                  style={{ ...styles.input, width: 220 }}
                  disabled={iAmLeader || busyByAuction[aId]}
                />

                <button
                  onClick={() => submitBid({ auction_id: aId, candidate_id: candidatureForDetail.id })}
                  disabled={iAmLeader || busyByAuction[aId]}
                  style={{
                    ...styles.btn,
                    ...styles.btnPrimary,
                    opacity: iAmLeader ? 0.55 : 1,
                    cursor: iAmLeader ? "not-allowed" : "pointer",
                  }}
                >
                  {busyByAuction[aId] ? "…" : "Enchérir"}
                </button>

                {iAmLeader && (
                  <span style={{ fontWeight: 900, opacity: 0.86 }}>
                    Vous êtes déjà le meilleur enchérisseur (aucune surenchère sur vous-même).
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODE LISTE (/entreprise/encheres)
  return (
    <div style={styles.page}>
      {responsiveHint}
      <div style={styles.container}>
        {Topbar}

        <div style={styles.hero}>
          <h1 style={styles.h1}>Mes enchères</h1>
          <p style={styles.p}>
            Liste privée : uniquement les enchères où votre entreprise est candidate.
          </p>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/entreprise" style={{ ...styles.btn, ...styles.btnPrimary }}>
              ← Retour au tableau de bord
            </Link>
            <Link to="/encheres" style={{ ...styles.btn, ...styles.btnAccent }}>
              Salle des enchères (publique)
            </Link>
          </div>

          {authMsg && <div style={styles.info}>{authMsg}</div>}
          {errorMsg && <div style={styles.warn}>⚠️ {errorMsg}</div>}
          {loading && <div style={{ marginTop: 10, opacity: 0.9 }}>Chargement…</div>}

          <div style={{ ...styles.card, marginTop: 14 }}>
            <h3 style={styles.cardTitle}>Candidatures</h3>
            <p style={styles.cardText}>
              Vous voyez ici vos enchères + vos meilleures mises + la meilleure offre actuelle.
            </p>

            {candidatures.length === 0 && !loading && (
              <div style={styles.info}>Aucune enchère pour votre entreprise.</div>
            )}

            {candidatures.length > 0 && (
              <div style={styles.list}>
                {candidatures.map((c) => (
                  <AuctionRow key={c.id} candidature={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}