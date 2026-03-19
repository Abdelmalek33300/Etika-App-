import { createClient } from "@supabase/supabase-js";

// -----------------------
// CONFIG À RENSEIGNER
// -----------------------
// 1) URL + anon key (Supabase → Project Settings → API)
const SUPABASE_URL = "https://athflnejxabgvbqcycnx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CW4BUPSQ5yv0r7rlhu3ULg_v_6kJrDy";

// 2) Auction ID (ta vente Électricité)
const AUCTION_ID = "4001a8cf-a89a-476a-9270-4bc3a598e4ab";

// 3) Comptes entreprises de test (emails + passwords)
const ACCOUNTS = [
  { email: "entreprise1@test.com", password: "Test123!" },
  { email: "entreprise2@test.com", password: "Test123!" },
  { email: "entreprise3@test.com", password: "Test123!" },
];

// 4) Paramètres de simulation
const STEP_EUR = 1000; // +1000 € à chaque fois
const INTERVAL_SEC = 15; // 15 secondes entre chaque mise
const DURATION_MIN = 30; // durée totale (minutes)

// -----------------------
// UTILITAIRES
// -----------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`[AUTH] ${email}: ${error.message}`);
  if (!data?.session?.user?.id) throw new Error(`[AUTH] ${email}: session.user.id manquant`);
  return data.session.user.id;
}

async function ensureCandidate(client, userId) {
  // 1) vérifier candidature existante
  const { data: existing, error: selErr } = await client
    .from("auction_candidates")
    .select("id, auction_id, user_id")
    .eq("auction_id", AUCTION_ID)
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) throw new Error(`[CANDIDATE SELECT] ${selErr.message}`);
  if (existing?.id) return existing.id;

  // 2) créer candidature (company_name UNIQUE par (auction_id, company_name))
  const payload = {
    auction_id: AUCTION_ID,
    user_id: userId,
    company_name: `Entreprise (simu) - ${userId.slice(0, 8)}`,
    company_country: "FR",
    company_website: "https://example.com",
  };

  const { data: created, error: insErr } = await client
    .from("auction_candidates")
    .insert(payload)
    .select("id")
    .single();

  if (insErr) throw new Error(`[CANDIDATE INSERT] ${insErr.message}`);
  return created.id;
}

async function getBestBidCents(client) {
  const { data, error } = await client
    .from("auction_bids")
    .select("amount_cents")
    .eq("auction_id", AUCTION_ID)
    .order("amount_cents", { ascending: false })
    .limit(1);

  if (error) throw new Error(`[BEST BID] ${error.message}`);
  const best = data?.[0]?.amount_cents ?? 0;
  return Number(best);
}

async function placeBid(client, userId, candidateId, amountCents) {
  const payload = {
    auction_id: AUCTION_ID,
    bidder_user_id: userId,
    candidate_id: candidateId,
    amount_cents: amountCents,
  };

  const { error } = await client.from("auction_bids").insert(payload);
  if (error) throw new Error(`[BID INSERT] ${error.message}`);
}

// -----------------------
// MAIN
// -----------------------
(async () => {
  const start = Date.now();
  const end = start + DURATION_MIN * 60 * 1000;

  // 1) créer un client par entreprise (session séparée)
  const clients = ACCOUNTS.map(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

  // 2) login + candidature
  const actors = [];
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const { email, password } = ACCOUNTS[i];
    const client = clients[i];

    const userId = await signIn(client, email, password);
    const candidateId = await ensureCandidate(client, userId);

    actors.push({ email, userId, candidateId, client });
    console.log(
      `[READY] ${email} user=${userId.slice(0, 8)}… candidate=${candidateId.slice(0, 8)}…`
    );
  }

  // 3) boucle de simulation
  let round = 0;
  while (Date.now() < end) {
    const actor = actors[round % actors.length];

    const best = await getBestBidCents(actor.client);
    const next = best + STEP_EUR * 100;

    try {
      await placeBid(actor.client, actor.userId, actor.candidateId, next);
      console.log(`[OK] round=${round} ${actor.email} bid=${next / 100}€ (best was ${best / 100}€)`);
    } catch (e) {
      console.log(`[FAIL] round=${round} ${actor.email} -> ${e.message}`);
    }

    round += 1;
    await sleep(INTERVAL_SEC * 1000);
  }

  console.log(`[DONE] duration=${DURATION_MIN}min rounds=${round}`);
  process.exit(0);
})().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
