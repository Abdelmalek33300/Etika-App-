import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./styles/encheres-public.css";

/**
 * Détail enchère PUBLIC (TEMPS RÉEL)
 * Route: /encheres/:auctionId
 *
 * - lecture seule, infos publiques uniquement
 * - classement de tous les candidats
 * - leader: pastille verte clignotante
 * - CTA vers l’espace entreprise
 * - TEMPS RÉEL via Supabase Realtime (postgres_changes)
 *
 * AUCUN changement backend.
 */

function eurFromCents(cents) {
  if (cents === null || cents === undefined) return null;
  const n = Number(cents);
  if (Number.isNaN(n)) return null;
  return (n / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDateFR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EnchereDetail() {
  const { auctionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [auction, setAuction] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [bids, setBids] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  // anti-spam refetch (si plusieurs events arrivent d’un coup)
  const refetchTimerRef = useRef(null);

  async function fetchAuction() {
    const { data, error } = await supabase
      .from("auctions")
      .select("id, sector, title, status, starts_at, ends_at, created_at")
      .eq("id", auctionId)
      .limit(1);

    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }

  async function fetchCandidates() {
    const { data, error } = await supabase
      .from("auction_candidates")
      .select("id, company_name, created_at")
      .eq("auction_id", auctionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).filter(Boolean);
  }

  async function fetchBids() {
    const { data, error } = await supabase
      .from("auction_bids")
      .select("candidate_id, amount_cents, created_at")
      .eq("auction_id", auctionId)
      .order("amount_cents", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).filter(Boolean);
  }

  async function loadAll() {
    setLoading(true);
    setErrorMsg("");
    try {
      const a = await fetchAuction();
      if (!a) throw new Error("Enchère introuvable.");

      const [c, b] = await Promise.all([fetchCandidates(), fetchBids()]);

      setAuction(a);
      setCandidates(c);
      setBids(b);
    } catch (e) {
      setErrorMsg(e?.message || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  // Chargement initial
  useEffect(() => {
    if (!auctionId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  // Realtime: subscribe aux changements pour CETTE enchère
  useEffect(() => {
    if (!auctionId) return;

    // Nettoyage timer au changement de page
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = null;
    }

    // petite fonction pour regrouper les events et refetch 1 seule fois
    const scheduleRefetch = (what = "bids") => {
      if (refetchTimerRef.current) return;

      refetchTimerRef.current = setTimeout(async () => {
        try {
          // On choisit le minimum : bids le plus souvent, candidates parfois, auction parfois.
          if (what === "bids") {
            const b = await fetchBids();
            setBids(b);
          } else if (what === "candidates") {
            const c = await fetchCandidates();
            setCandidates(c);
          } else if (what === "auction") {
            const a = await fetchAuction();
            if (a) setAuction(a);
          } else if (what === "all") {
            const [a, c, b] = await Promise.all([fetchAuction(), fetchCandidates(), fetchBids()]);
            if (a) setAuction(a);
            setCandidates(c);
            setBids(b);
          }
        } catch {
          // En public, on évite d’afficher une erreur intrusive sur un event realtime
          // (la page reste lisible et se resync au prochain event/reload)
        } finally {
          clearTimeout(refetchTimerRef.current);
          refetchTimerRef.current = null;
        }
      }, 220); // 220ms = anti-spam, très réactif
    };

    // Channel unique pour l’enchère
    const channel = supabase
      .channel(`public-auction-${auctionId}`)
      // bids: INSERT/UPDATE/DELETE
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_bids", filter: `auction_id=eq.${auctionId}` },
        () => scheduleRefetch("bids")
      )
      // candidats: pour que le tableau se mette à jour si nouvelle candidature
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_candidates", filter: `auction_id=eq.${auctionId}` },
        () => scheduleRefetch("candidates")
      )
      // enchère: si status/ends_at changent
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` },
        () => scheduleRefetch("auction")
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  // Meilleur montant par candidat
  const bestBidByCandidateId = useMemo(() => {
    const map = new Map();
    for (const bid of bids) {
      const cid = bid.candidate_id;
      const amt = bid.amount_cents;
      if (!cid || amt === null || amt === undefined) continue;
      const prev = map.get(cid);
      if (prev === undefined || amt > prev) map.set(cid, amt);
    }
    return map;
  }, [bids]);

  const rankedCandidates = useMemo(() => {
    const rows = candidates.map((c) => {
      const best = bestBidByCandidateId.get(c.id);
      return {
        id: c.id,
        name: c.company_name || "—",
        created_at: c.created_at,
        best_cents: best ?? null,
      };
    });

    rows.sort((a, b) => {
      const av = a.best_cents === null ? -1 : a.best_cents;
      const bv = b.best_cents === null ? -1 : b.best_cents;
      if (bv !== av) return bv - av;
      const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ad - bd;
    });

    return rows;
  }, [candidates, bestBidByCandidateId]);

  const leader = rankedCandidates.length > 0 ? rankedCandidates[0] : null;
  const leaderHasBid = leader && leader.best_cents !== null;

  const topAmountLabel = useMemo(() => {
    if (!leader || leader.best_cents === null) return "Aucune offre";
    return eurFromCents(leader.best_cents) || "Aucune offre";
  }, [leader]);

  if (loading) {
    return (
      <div className="ep-wrap">
        <header className="ep-header">
          <h1 className="ep-title">Détail enchère (publique)</h1>
          <p className="ep-subtitle">Lecture seule — informations publiques</p>
        </header>
        <div className="ep-loading">Chargement…</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="ep-wrap">
        <header className="ep-header">
          <div className="ep-header-row">
            <div>
              <h1 className="ep-title">Détail enchère (publique)</h1>
              <p className="ep-subtitle">Lecture seule — informations publiques</p>
            </div>
            <div className="ep-header-actions">
              <button className="ep-btn" onClick={() => navigate("/encheres")}>
                ← Retour mosaïque
              </button>
            </div>
          </div>
        </header>
        <div className="ep-empty ep-empty-box">
          <h2 className="ep-empty-title">Impossible d’afficher l’enchère</h2>
          <p className="ep-empty-text">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-wrap">
      <style>{`
        .ed-hero {
          border: 1px solid rgba(0,0,0,0.10);
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,255,255,0.78);
          box-shadow: 0 8px 22px rgba(0,0,0,0.06);
        }
        .ed-hero-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ed-sector {
          font-weight: 900;
          letter-spacing: -0.2px;
          font-size: 16px;
        }
        .ed-title {
          margin-top: 6px;
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.3px;
        }
        .ed-meta {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 13px;
          opacity: 0.92;
        }
        .ed-kpi {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 760px) {
          .ed-kpi { grid-template-columns: 1fr; }
        }
        .ed-kpi-box {
          border: 1px solid rgba(0,0,0,0.10);
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,0.75);
        }
        .ed-kpi-label {
          font-size: 12px;
          opacity: 0.75;
          font-weight: 800;
        }
        .ed-kpi-value {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.2px;
        }
        .ed-actions {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }
        .ed-cta {
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(255,255,255,0.92);
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 900;
          text-decoration: none;
          display: inline-block;
        }
        .ed-cta:hover { background: rgba(255,255,255,1); }
        .ed-table {
          margin-top: 12px;
          display: grid;
          gap: 10px;
        }
        .ed-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.10);
          padding: 12px;
          background: rgba(255,255,255,0.75);
        }
        .ed-row-left { min-width: 0; }
        .ed-row-name {
          font-weight: 950;
          letter-spacing: -0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 520px;
        }
        .ed-row-sub {
          margin-top: 4px;
          font-size: 12px;
          opacity: 0.78;
        }
        .ed-row-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .ed-amount {
          font-weight: 950;
          font-size: 14px;
        }
        .ed-pill {
          font-size: 12px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.75);
          border: 1px solid rgba(0,0,0,0.08);
          white-space: nowrap;
        }
        .ed-leader-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #1db954;
          box-shadow: 0 0 0 rgba(29,185,84, 0.0);
          animation: edBlink 1s infinite;
        }
        @keyframes edBlink {
          0%   { transform: scale(1);   box-shadow: 0 0 0 rgba(29,185,84, 0.0); }
          50%  { transform: scale(1.15); box-shadow: 0 0 10px rgba(29,185,84, 0.55); }
          100% { transform: scale(1);   box-shadow: 0 0 0 rgba(29,185,84, 0.0); }
        }
        .ed-rank {
          font-size: 12px;
          font-weight: 950;
          opacity: 0.75;
          min-width: 34px;
          text-align: right;
        }
        .ed-live {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 900;
          opacity: 0.8;
        }
        .ed-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #1db954;
          animation: edBlink 1.2s infinite;
        }
      `}</style>

      <header className="ep-header">
        <div className="ep-header-row">
          <div>
            <h1 className="ep-title">Détail enchère (publique)</h1>
            <p className="ep-subtitle">
              Lecture seule — informations publiques{" "}
              <span className="ed-live">
                <span className="ed-live-dot" /> LIVE
              </span>
            </p>
          </div>
          <div className="ep-header-actions">
            <button className="ep-btn" onClick={() => navigate("/encheres")}>
              ← Retour mosaïque
            </button>
          </div>
        </div>
      </header>

      <section className="ed-hero">
        <div className="ed-hero-top">
          <div style={{ minWidth: 0 }}>
            <div className="ed-sector">{auction?.sector || "—"}</div>
            <div className="ed-title">{auction?.title || "Enchère"}</div>
            <div className="ed-meta">
              <span className="ep-muted">Statut :</span>{" "}
              <strong>{auction?.status || "—"}</strong>
              <span className="ep-dot">•</span>
              <span className="ep-muted">Fin :</span>{" "}
              <strong>{formatDateFR(auction?.ends_at)}</strong>
            </div>
          </div>

          <div className="ed-pill">
            {auction?.status === "open" ? "Enchère ouverte" : "Enchère"}
          </div>
        </div>

        <div className="ed-kpi">
          <div className="ed-kpi-box">
            <div className="ed-kpi-label">Meilleure offre</div>
            <div className="ed-kpi-value">{topAmountLabel}</div>
          </div>

          <div className="ed-kpi-box">
            <div className="ed-kpi-label">Leader</div>
            <div className="ed-kpi-value">{leaderHasBid ? (leader?.name || "—") : "—"}</div>
          </div>

          <div className="ed-kpi-box">
            <div className="ed-kpi-label">Candidats</div>
            <div className="ed-kpi-value">{rankedCandidates.length}</div>
          </div>
        </div>

        <div className="ed-actions">
          <Link className="ed-cta" to={`/entreprise/encherir/${auctionId}`}>
            Accéder à l’espace entreprise pour enchérir →
          </Link>

          <span className="ep-muted" style={{ fontSize: 12 }}>
            (La mise se fait uniquement dans l’espace entreprise)
          </span>
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <h2 className="ep-list-title">Classement (tous les candidats)</h2>

        {rankedCandidates.length === 0 ? (
          <div className="ep-empty ep-empty-box">
            <h3 className="ep-empty-title">Aucun candidat pour le moment</h3>
            <p className="ep-empty-text">Les candidatures apparaîtront ici dès qu’elles sont enregistrées.</p>
          </div>
        ) : (
          <div className="ed-table">
            {rankedCandidates.map((c, idx) => {
              const isLeader = idx === 0 && c.best_cents !== null;
              const amountLabel =
                c.best_cents === null ? "Aucune offre" : (eurFromCents(c.best_cents) || "Aucune offre");

              return (
                <div key={c.id} className="ed-row">
                  <div className="ed-row-left">
                    <div className="ed-row-name">{c.name}</div>
                    <div className="ed-row-sub">
                      <span className="ep-muted">Inscription :</span>{" "}
                      <strong>{formatDateFR(c.created_at)}</strong>
                    </div>
                  </div>

                  <div className="ed-row-right">
                    <div className="ed-rank">#{idx + 1}</div>
                    {isLeader && <div className="ed-leader-dot" title="Leader"></div>}
                    <div className="ed-amount">{amountLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="ep-footer">
        <div className="ep-muted">
          Rappel : cette page est publique (lecture seule). Aucun élément “personnel entreprise” n’est affiché ici.
        </div>
      </footer>
    </div>
  );
}