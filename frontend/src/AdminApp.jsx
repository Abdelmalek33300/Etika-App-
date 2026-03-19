import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export default function AdminApp() {
  // -----------------------
  // AUTH
  // -----------------------
  const [session, setSession] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // -----------------------
  // UI MESSAGES
  // -----------------------
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // -----------------------
  // AUCTIONS
  // -----------------------
  const [auctionsLoading, setAuctionsLoading] = useState(false);
  const [auctions, setAuctions] = useState([]);

  // -----------------------
  // MONITORING
  // -----------------------
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorByAuction, setMonitorByAuction] = useState({});

  // Form création
  const [form, setForm] = useState({
    title: "",
    sector: "",
    starts_at: "",
    ends_at: "",
    status: "open",
    starting_price_eur: "100000",
    min_increment_eur: "1000",
  });

  function toIsoOrNull(datetimeLocalValue) {
    if (!datetimeLocalValue) return null;
    const d = new Date(datetimeLocalValue);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function eurToCentsOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(String(v).replace(",", "."));
    if (Number.isNaN(n)) return null;
    return Math.round(n * 100);
  }

  const canCreate = useMemo(() => {
    const titleOk = form.title.trim().length >= 3;
    const sectorOk = form.sector.trim().length >= 2;

    const startsIso = toIsoOrNull(form.starts_at);
    const endsIso = toIsoOrNull(form.ends_at);

    const datesOk =
      !!startsIso &&
      !!endsIso &&
      new Date(endsIso).getTime() > new Date(startsIso).getTime();

    const statusOk = form.status === "open" || form.status === "closed";

    const startCents = eurToCentsOrNull(form.starting_price_eur);
    const incCents = eurToCentsOrNull(form.min_increment_eur);

    const pricingOk =
      startCents !== null &&
      incCents !== null &&
      startCents > 0 &&
      incCents > 0 &&
      incCents >= 100; // >= 1€

    return titleOk && sectorOk && datesOk && statusOk && pricingOk;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.title,
    form.sector,
    form.starts_at,
    form.ends_at,
    form.status,
    form.starting_price_eur,
    form.min_increment_eur,
  ]);

  // -----------------------
  // BOOT SESSION
  // -----------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      setBootLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
      setBootLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // -----------------------
  // ACTIONS AUTH
  // -----------------------
  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email || !password) {
      setErr("Merci de saisir email + mot de passe.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("✅ Connecté.");
    await refreshAuctions();
  }

  async function handleLogout() {
    setErr("");
    setMsg("");
    await supabase.auth.signOut();
    setSession(null);
    setMsg("Déconnecté.");
  }

  // -----------------------
  // AUCTIONS CRUD (READ + CREATE)
  // -----------------------
  async function refreshAuctions() {
    setAuctionsLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("auctions")
      .select(
        "id,title,sector,status,starts_at,ends_at,starting_price_cents,min_increment_cents,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setAuctions([]);
      setAuctionsLoading(false);
      return;
    }

    const list = data ?? [];
    setAuctions(list);
    setAuctionsLoading(false);

    await refreshMonitoring(list);
  }

  // -----------------------
  // ADMIN ACTION : CLOSE ONLY (PRO)
  // -----------------------
  async function closeAuction(id) {
    setErr("");
    setMsg("");

    const { error } = await supabase
      .from("auctions")
      .update({ status: "closed" })
      .eq("id", id);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("✅ Enchère clôturée.");
    await refreshAuctions();
  }

  // -----------------------
  // MONITORING
  // -----------------------
  async function refreshMonitoring(auctionList) {
    try {
      setMonitorLoading(true);

      const ids = (auctionList ?? []).map((a) => a.id).filter(Boolean);
      if (ids.length === 0) {
        setMonitorByAuction({});
        setMonitorLoading(false);
        return;
      }

      const { data: cands, error: cErr } = await supabase
        .from("auction_candidates")
        .select("auction_id, user_id, company_name")
        .in("auction_id", ids);

      if (cErr) {
        setMonitorByAuction({});
        setMonitorLoading(false);
        return;
      }

      const candidatesCountByAuction = {};
      const companyNameByUser = {};
      for (const r of cands ?? []) {
        if (!r?.auction_id) continue;
        candidatesCountByAuction[r.auction_id] =
          (candidatesCountByAuction[r.auction_id] ?? 0) + 1;
        if (r.user_id && r.company_name) companyNameByUser[r.user_id] = r.company_name;
      }

      const { data: bids, error: bErr } = await supabase
        .from("auction_bids")
        .select("auction_id, amount_cents, bidder_user_id, created_at")
        .in("auction_id", ids)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (bErr) {
        setMonitorByAuction({});
        setMonitorLoading(false);
        return;
      }

      const bidsCountByAuction = {};
      const leaderByAuction = {};
      for (const b of bids ?? []) {
        if (!b?.auction_id) continue;

        bidsCountByAuction[b.auction_id] = (bidsCountByAuction[b.auction_id] ?? 0) + 1;

        const currentLeader = leaderByAuction[b.auction_id];
        if (!currentLeader) {
          leaderByAuction[b.auction_id] = {
            amount_cents: b.amount_cents,
            bidder_user_id: b.bidder_user_id,
            created_at: b.created_at,
          };
        } else {
          const a1 = Number(b.amount_cents ?? 0);
          const a2 = Number(currentLeader.amount_cents ?? 0);
          if (a1 > a2) {
            leaderByAuction[b.auction_id] = {
              amount_cents: b.amount_cents,
              bidder_user_id: b.bidder_user_id,
              created_at: b.created_at,
            };
          } else if (a1 === a2) {
            const t1 = b.created_at ? new Date(b.created_at).getTime() : 0;
            const t2 = currentLeader.created_at ? new Date(currentLeader.created_at).getTime() : 0;
            if (t1 > t2) {
              leaderByAuction[b.auction_id] = {
                amount_cents: b.amount_cents,
                bidder_user_id: b.bidder_user_id,
                created_at: b.created_at,
              };
            }
          }
        }
      }

      const next = {};
      for (const a of auctionList ?? []) {
        const auctionId = a.id;
        const leader = leaderByAuction[auctionId];

        const leaderName =
          leader?.bidder_user_id && companyNameByUser[leader.bidder_user_id]
            ? companyNameByUser[leader.bidder_user_id]
            : leader?.bidder_user_id
            ? "(leader)"
            : "—";

        const currentAmountCents =
          leader?.amount_cents != null
            ? Number(leader.amount_cents)
            : Number(a.starting_price_cents ?? 0);

        next[auctionId] = {
          candidatesCount: Number(candidatesCountByAuction[auctionId] ?? 0),
          bidsCount: Number(bidsCountByAuction[auctionId] ?? 0),
          currentAmountCents,
          leaderName,
        };
      }

      setMonitorByAuction(next);
      setMonitorLoading(false);
    } catch {
      setMonitorByAuction({});
      setMonitorLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.id) refreshAuctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  function friendlyCreateError(message) {
    if (String(message).includes("ux_auctions_sector_open")) {
      return "Impossible : il existe déjà une enchère OUVERTE pour ce secteur. Ferme l’ancienne enchère ou choisis un autre secteur.";
    }
    if (String(message).toLowerCase().includes("auctions_starting_price_positive")) {
      return "Impossible : la mise de départ doit être strictement supérieure à 0.";
    }
    if (String(message).toLowerCase().includes("auctions_min_increment_positive")) {
      return "Impossible : l’incrément minimum doit être strictement supérieur à 0.";
    }
    if (String(message).toLowerCase().includes("auctions_time_window_valid")) {
      return "Impossible : la date de fin doit être après la date de début.";
    }
    return message;
  }

  async function createAuction(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!canCreate) {
      setErr("Formulaire incomplet : titre, secteur, dates, mise de départ et incrément minimum.");
      return;
    }

    const startingCents = eurToCentsOrNull(form.starting_price_eur);
    const incCents = eurToCentsOrNull(form.min_increment_eur);

    const payload = {
      title: form.title.trim(),
      sector: form.sector.trim(),
      starts_at: toIsoOrNull(form.starts_at),
      ends_at: toIsoOrNull(form.ends_at),
      status: form.status,
      starting_price_cents: startingCents,
      min_increment_cents: incCents,
    };

    const { error } = await supabase.from("auctions").insert(payload);

    if (error) {
      setErr(friendlyCreateError(error.message));
      return;
    }

    setMsg("✅ Enchère créée.");
    setForm({
      title: "",
      sector: "",
      starts_at: "",
      ends_at: "",
      status: "open",
      starting_price_eur: "100000",
      min_increment_eur: "1000",
    });
    await refreshAuctions();
  }

  // -----------------------
  // HELPERS UI
  // -----------------------
  const statusLabel = (s) => {
    if (s === "open") return "Ouverte";
    if (s === "closed") return "Clôturée";
    return s ?? "—";
  };

  const euro = (cents) => {
    const n = Number(cents ?? 0) / 100;
    return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const TABLE_COLS = [
    "title",
    "sector",
    "status",
    "current_amount",
    "leader",
    "candidates_count",
    "bids_count",
    "starting_price_cents",
    "min_increment_cents",
    "starts_at",
    "ends_at",
    "created_at",
    "id",
  ];

  const headerLabel = {
    title: "Titre",
    sector: "Secteur",
    status: "Statut",
    current_amount: "Montant actuel (€)",
    leader: "Leader",
    candidates_count: "Candidats",
    bids_count: "Mises",
    starting_price_cents: "Départ (€)",
    min_increment_cents: "Incrément min (€)",
    starts_at: "Début",
    ends_at: "Fin",
    created_at: "Créée le",
    id: "ID",
  };

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("✅ ID copié dans le presse-papiers.");
    } catch {
      setMsg("Copie impossible (sécurité navigateur).");
    }
  }

  if (bootLoading) {
    return (
      <div style={{ fontFamily: "system-ui, Arial", padding: 24 }}>
        <h2>Chargement…</h2>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 24, maxWidth: 1100 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Espace Admin</h1>
          <div style={{ marginTop: 6, color: "#444" }}>
            Connecté : <strong>{session?.user?.email ?? "—"}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={refreshAuctions}
            style={{ padding: "8px 12px", cursor: session ? "pointer" : "not-allowed" }}
            disabled={!session || auctionsLoading}
            title="Rafraîchir la liste"
          >
            {auctionsLoading ? "Rafraîchissement…" : "Rafraîchir"}
          </button>

          <button
            onClick={handleLogout}
            style={{ padding: "8px 12px", cursor: session ? "pointer" : "not-allowed" }}
            disabled={!session}
          >
            Se déconnecter
          </button>
        </div>
      </header>

      {/* Messages */}
      <div style={{ marginTop: 14 }}>
        {msg ? (
          <div style={{ padding: 10, border: "1px solid #cfe8cf", background: "#f2fbf2", borderRadius: 10 }}>
            {msg}
          </div>
        ) : null}
        {err ? (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid #f0c0c0", background: "#fff3f3", borderRadius: 10 }}>
            <strong>Erreur :</strong> {err}
          </div>
        ) : null}
      </div>

      {/* Connexion si pas de session */}
      {!session ? (
        <section style={{ marginTop: 18, padding: 16, border: "1px solid #ddd", borderRadius: 12, maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>Connexion Admin</h2>

          <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label>
                <strong>Email</strong>
              </label>
              <input
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@email.com"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>
                <strong>Mot de passe</strong>
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #111",
                cursor: "pointer",
                background: "#111",
                color: "#fff",
                width: 180,
              }}
            >
              Se connecter
            </button>
          </form>
        </section>
      ) : null}

      {/* UI admin complète si connecté */}
      {session ? (
        <>
          {/* Bloc création */}
          <section style={{ marginTop: 18, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
            <h2 style={{ marginTop: 0 }}>Créer une enchère</h2>

            <form onSubmit={createAuction} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <strong>Titre</strong>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Ex : Sponsor officiel — Télécom"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <strong>Secteur</strong>
                </label>
                <input
                  value={form.sector}
                  onChange={(e) => setForm((s) => ({ ...s, sector: e.target.value }))}
                  placeholder="Ex : Électricité"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
                <div style={{ fontSize: 12, color: "#555" }}>
                  Utilise une valeur de <code>sectors_catalog</code>.
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label>
                    <strong>Début</strong>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm((s) => ({ ...s, starts_at: e.target.value }))}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label>
                    <strong>Fin</strong>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm((s) => ({ ...s, ends_at: e.target.value }))}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 520 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label>
                    <strong>Mise de départ (€)</strong>
                  </label>
                  <input
                    inputMode="decimal"
                    value={form.starting_price_eur}
                    onChange={(e) => setForm((s) => ({ ...s, starting_price_eur: e.target.value }))}
                    placeholder="Ex : 100000"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label>
                    <strong>Incrément minimum (€)</strong>
                  </label>
                  <input
                    inputMode="decimal"
                    value={form.min_increment_eur}
                    onChange={(e) => setForm((s) => ({ ...s, min_increment_eur: e.target.value }))}
                    placeholder="Ex : 1000"
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: 6, maxWidth: 260 }}>
                <label>
                  <strong>Statut</strong>
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                >
                  <option value="open">Ouverte</option>
                  <option value="closed">Clôturée</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                <button
                  type="submit"
                  disabled={!canCreate}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    cursor: !canCreate ? "not-allowed" : "pointer",
                    background: !canCreate ? "#eee" : "#111",
                    color: !canCreate ? "#555" : "#fff",
                    width: 170,
                  }}
                >
                  Créer l’enchère
                </button>

                {!canCreate ? (
                  <span style={{ color: "#666" }}>Champs requis : titre, secteur, dates, départ, incrément.</span>
                ) : null}
              </div>
            </form>
          </section>

          {/* Liste enchères (contrôle + monitoring) */}
          <section style={{ marginTop: 18, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>Enchères (contrôle)</h2>
              <div style={{ color: "#666", fontSize: 13 }}>Monitoring : {monitorLoading ? "chargement…" : "OK"}</div>
            </div>

            {auctionsLoading ? (
              <p>Chargement…</p>
            ) : auctions.length === 0 ? (
              <p>Aucune enchère.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {TABLE_COLS.map((h) => (
                        <th
                          key={h}
                          style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" }}
                        >
                          {headerLabel[h] ?? h}
                        </th>
                      ))}
                      <th style={{ padding: "10px 8px", borderBottom: "1px solid #ddd" }}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {auctions.map((a) => {
                      const mon = monitorByAuction[a.id] ?? null;

                      return (
                        <tr key={a.id}>
                          {TABLE_COLS.map((k) => (
                            <td
                              key={k}
                              style={{
                                padding: "10px 8px",
                                borderBottom: "1px solid #f0f0f0",
                                whiteSpace: "nowrap",
                                fontFamily: k === "id" ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
                                fontSize: k === "id" ? 12 : 14,
                              }}
                            >
                              {k === "status"
                                ? statusLabel(a?.[k])
                                : k === "starting_price_cents"
                                ? euro(a?.[k])
                                : k === "min_increment_cents"
                                ? euro(a?.[k])
                                : k === "current_amount"
                                ? mon
                                  ? euro(mon.currentAmountCents)
                                  : "—"
                                : k === "leader"
                                ? mon
                                  ? mon.leaderName
                                  : "—"
                                : k === "candidates_count"
                                ? mon
                                  ? String(mon.candidatesCount)
                                  : "—"
                                : k === "bids_count"
                                ? mon
                                  ? String(mon.bidsCount)
                                  : "—"
                                : a?.[k] ?? "—"}
                            </td>
                          ))}

                          <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button onClick={() => copy(a.id)} style={{ padding: "6px 10px", cursor: "pointer" }} title="Copier l’ID">
                                ID
                              </button>

                              {a.status === "open" ? (
                                <button
                                  onClick={() => closeAuction(a.id)}
                                  style={{
                                    padding: "6px 10px",
                                    background: "#c62828",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                  }}
                                  title="Clôturer l’enchère"
                                >
                                  Fermer
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}