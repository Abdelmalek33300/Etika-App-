import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./styles/encheres-public.css";

/**
 * Salle publique (lecture seule)
 * - /encheres : mosaïque secteurs
 * - /encheres?sector=Telecom : vue secteur
 *
 * IMPORTANT:
 * - AUCUNE info privée entreprise (rang, ma mise, etc.)
 * - Aucun changement backend
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

function stripAccents(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function normKey(s = "") {
  return stripAccents(String(s)).toLowerCase();
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const SOFT_COLORS = [
  "soft-a",
  "soft-b",
  "soft-c",
  "soft-d",
  "soft-e",
  "soft-f",
  "soft-g",
  "soft-h",
  "soft-i",
  "soft-j",
];

export default function EncheresPublic() {
  const navigate = useNavigate();
  const query = useQuery();
  const sectorParamRaw = query.get("sector") || "";
  const sectorParam = sectorParamRaw.trim();

  const [loading, setLoading] = useState(true);
  const [loadingSector, setLoadingSector] = useState(false);

  const [sectors, setSectors] = useState([]);
  const [openAuctions, setOpenAuctions] = useState([]);
  const [auctionMetaById, setAuctionMetaById] = useState({});

  const selectedSectorKey = sectorParam ? normKey(sectorParam) : "";

  const sectorsWithStyle = useMemo(() => {
    return sectors.map((s, idx) => ({
      ...s,
      colorClass: SOFT_COLORS[idx % SOFT_COLORS.length],
    }));
  }, [sectors]);

  const openAuctionsBySectorKey = useMemo(() => {
    const map = new Map();
    for (const a of openAuctions) {
      const sk = normKey(a.sector || "");
      if (!map.has(sk)) map.set(sk, []);
      map.get(sk).push(a);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((x, y) => {
        const xe = x.ends_at ? new Date(x.ends_at).getTime() : Number.POSITIVE_INFINITY;
        const ye = y.ends_at ? new Date(y.ends_at).getTime() : Number.POSITIVE_INFINITY;
        return xe - ye;
      });
      map.set(k, arr);
    }
    return map;
  }, [openAuctions]);

  const selectedAuctions = useMemo(() => {
    if (!selectedSectorKey) return [];
    return openAuctionsBySectorKey.get(selectedSectorKey) || [];
  }, [selectedSectorKey, openAuctionsBySectorKey]);

  const hasAuctionForSelectedSector = selectedAuctions.length > 0;

  function goToGrid() {
    navigate("/encheres", { replace: false });
  }

  function goToSector(name) {
    navigate(`/encheres?sector=${encodeURIComponent(name)}`);
  }

  function goToAuction(auctionId) {
    navigate(`/encheres/${auctionId}`);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadBase() {
      setLoading(true);

      // 1) Sectors catalog (si dispo)
      let sectorRows = [];
      try {
        const { data, error } = await supabase
          .from("sectors_catalog")
          .select("name, is_active, sort_order")
          .order("sort_order", { ascending: true });

        if (error) throw error;

        sectorRows = (data || [])
          .filter((r) => r && (r.is_active === true || r.is_active === null || r.is_active === undefined))
          .map((r) => ({ name: r.name, key: normKey(r.name) }))
          .filter((r) => r.name);
      } catch {
        sectorRows = [];
      }

      // 2) Open auctions
      let auctionsRows = [];
      try {
        const { data, error } = await supabase
          .from("auctions")
          .select("id, sector, title, status, starts_at, ends_at, created_at")
          .eq("status", "open")
          .order("created_at", { ascending: false });

        if (error) throw error;
        auctionsRows = (data || []).filter(Boolean);
      } catch {
        auctionsRows = [];
      }

      // fallback secteurs depuis auctions si besoin
      if (sectorRows.length === 0) {
        const set = new Map();
        for (const a of auctionsRows) {
          const nm = a.sector || "";
          const k = normKey(nm);
          if (!nm || !k) continue;
          if (!set.has(k)) set.set(k, { name: nm, key: k });
        }
        sectorRows = Array.from(set.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
      }

      if (cancelled) return;

      setSectors(sectorRows);
      setOpenAuctions(auctionsRows);

      // 3) Meta leader/top bid par enchère
      const meta = {};
      await Promise.all(
        auctionsRows.map(async (a) => {
          try {
            const { data: bids, error: e1 } = await supabase
              .from("auction_bids")
              .select("amount_cents, candidate_id, created_at")
              .eq("auction_id", a.id)
              .order("amount_cents", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1);

            if (e1) throw e1;

            const top = bids && bids[0] ? bids[0] : null;
            if (!top) {
              meta[a.id] = { topBidCents: null, leaderName: null };
              return;
            }

            let leaderName = null;
            if (top.candidate_id) {
              const { data: cand, error: e2 } = await supabase
                .from("auction_candidates")
                .select("company_name")
                .eq("id", top.candidate_id)
                .limit(1);

              if (!e2 && cand && cand[0] && cand[0].company_name) {
                leaderName = cand[0].company_name;
              }
            }

            meta[a.id] = { topBidCents: top.amount_cents ?? null, leaderName };
          } catch {
            meta[a.id] = { topBidCents: null, leaderName: null };
          }
        })
      );

      if (cancelled) return;

      setAuctionMetaById(meta);
      setLoading(false);
    }

    loadBase();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sectorParam) return;
    setLoadingSector(true);
    const t = setTimeout(() => setLoadingSector(false), 180);
    return () => clearTimeout(t);
  }, [sectorParam]);

  if (loading) {
    return (
      <div className="ep-wrap">
        <header className="ep-header">
          <div className="ep-topnav">
            <div className="ep-brand">
              <span className="ep-brand-dot" />
              <span className="ep-brand-name">ALLIANCE</span>
              <span className="ep-brand-badge">ENCHÈRES</span>
            </div>
            <nav className="ep-nav">
              <Link className="ep-nav-link" to="/">
                Accueil
              </Link>
              <Link className="ep-nav-link" to="/encheres">
                Salle publique
              </Link>
              <Link className="ep-nav-link" to="/entreprise">
                Entreprise
              </Link>
            </nav>
          </div>

          <h1 className="ep-title">Salle publique</h1>
          <p className="ep-subtitle">Lecture seule — état de la compétition par secteur</p>
        </header>
        <div className="ep-loading">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="ep-wrap">
      <header className="ep-header">
        <div className="ep-topnav">
          <div className="ep-brand">
            <span className="ep-brand-dot" />
            <span className="ep-brand-name">ALLIANCE</span>
            <span className="ep-brand-badge">ENCHÈRES</span>
          </div>

          <nav className="ep-nav">
            <Link className="ep-nav-link" to="/">
              Accueil
            </Link>
            <Link className="ep-nav-link ep-nav-link--active" to="/encheres">
              Salle publique
            </Link>
            <Link className="ep-nav-link" to="/entreprise">
              Entreprise
            </Link>
            <button
              className="ep-nav-link ep-nav-link--ghost"
              type="button"
              onClick={() => alert("Espace consommateur : à venir (Phase 1).")}
            >
              Consommateur
            </button>
          </nav>
        </div>

        <div className="ep-header-row">
          <div>
            <h1 className="ep-title">Salle des enchères (publique)</h1>
            <p className="ep-subtitle">Lecture seule — aucune information privée entreprise n’est affichée</p>
          </div>

          <div className="ep-header-actions">
            {sectorParam ? (
              <button className="ep-btn" onClick={goToGrid}>
                ← Retour mosaïque
              </button>
            ) : (
              <Link className="ep-btn ep-btn-primary ep-btn-link" to="/entreprise">
                Connexion entreprise →
              </Link>
            )}
          </div>
        </div>

        {sectorParam ? (
          <div className="ep-breadcrumb">
            <span className="ep-muted">Secteur sélectionné :</span> <strong>{sectorParam}</strong>
          </div>
        ) : (
          <div className="ep-muted ep-hint">
            Cliquez sur un secteur pour voir l’enchère (si elle existe) ou un état “aucune enchère”.
          </div>
        )}
      </header>

      {/* VUE MOSAÏQUE */}
      {!sectorParam && (
        <main className="ep-main">
          <section className="ep-grid" aria-label="Mosaïque des secteurs">
            {sectorsWithStyle.length === 0 ? (
              <div className="ep-empty">Aucun secteur disponible pour l’instant.</div>
            ) : (
              sectorsWithStyle.map((s) => {
                const sectorAuctions = openAuctionsBySectorKey.get(s.key) || [];
                const firstAuction = sectorAuctions[0] || null;

                const meta = firstAuction ? auctionMetaById[firstAuction.id] : null;

                const topBidLabel = meta ? eurFromCents(meta.topBidCents) : null;
                const leaderLabel = meta?.leaderName || null;

                return (
                  <button
                    key={s.key}
                    className={`ep-card ${s.colorClass}`}
                    onClick={() => {
                      if (firstAuction) goToAuction(firstAuction.id);
                      else goToSector(s.name);
                    }}
                    type="button"
                  >
                    <div className="ep-card-top">
                      <div className="ep-card-sector">{s.name}</div>
                      <div className="ep-card-chip">{firstAuction ? "Enchère ouverte" : "Aucune enchère"}</div>
                    </div>

                    <div className="ep-card-body">
                      {firstAuction ? (
                        <>
                          <div className="ep-card-amount">{topBidLabel ? topBidLabel : "Aucune offre"}</div>
                          <div className="ep-card-leader">
                            <span className="ep-muted">Leader :</span> <strong>{leaderLabel ? leaderLabel : "—"}</strong>
                          </div>
                          <div className="ep-card-mini">
                            <span className="ep-muted">Fin :</span> <strong>{formatDateFR(firstAuction.ends_at)}</strong>
                          </div>
                        </>
                      ) : (
                        <div className="ep-card-none">Cliquez pour voir le secteur (état “aucune enchère”).</div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </section>
        </main>
      )}

      {/* VUE SECTEUR */}
      {sectorParam && (
        <main className="ep-main">
          <section className="ep-sector" aria-label="Vue secteur">
            {loadingSector ? (
              <div className="ep-loading">Chargement…</div>
            ) : (
              <>
                {!hasAuctionForSelectedSector ? (
                  <div className="ep-empty ep-empty-box">
                    <h2 className="ep-empty-title">Aucune enchère ouverte pour ce secteur</h2>
                    <p className="ep-empty-text">
                      Il n’y a pas d’enchère <strong>open</strong> pour <strong>{sectorParam}</strong> pour le moment.
                    </p>
                    <div className="ep-empty-actions">
                      <button className="ep-btn" onClick={goToGrid}>
                        ← Retour mosaïque
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ep-list">
                    <h2 className="ep-list-title">Enchères ouvertes — {sectorParam}</h2>

                    {selectedAuctions.map((a) => {
                      const meta = auctionMetaById[a.id] || {};
                      const topBidLabel = eurFromCents(meta.topBidCents);

                      return (
                        <div key={a.id} className="ep-row">
                          <div className="ep-row-main">
                            <div className="ep-row-title">{a.title || "Enchère"}</div>
                            <div className="ep-row-sub">
                              <span className="ep-muted">Leader :</span> <strong>{meta.leaderName || "—"}</strong>
                              <span className="ep-dot">•</span>
                              <span className="ep-muted">Montant :</span> <strong>{topBidLabel || "Aucune offre"}</strong>
                              <span className="ep-dot">•</span>
                              <span className="ep-muted">Fin :</span> <strong>{formatDateFR(a.ends_at)}</strong>
                            </div>
                          </div>

                          <div className="ep-row-actions">
                            <button className="ep-btn" onClick={() => goToAuction(a.id)}>
                              Voir détail
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      )}

      <footer className="ep-footer">
        <div className="ep-muted">
          Rappel : la Salle publique affiche uniquement des informations publiques (compétition), jamais des données privées entreprise.
        </div>
      </footer>
    </div>
  );
}