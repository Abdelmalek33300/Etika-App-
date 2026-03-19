/**
 * Test Anti-triche A — Mise plus basse que la meilleure
 * Objectif: vérifier que le SQL bloque une mise < best_bid
 *
 * Prérequis (.env):
 * - SUPABASE_URL, SUPABASE_ANON_KEY
 * - AUCTION_ID
 * - COMPANY1_EMAIL/PASSWORD
 * - COMPANY2_EMAIL/PASSWORD
 *
 * Schéma (confirmé):
 * auction_candidates: id (uuid), auction_id (uuid), user_id (uuid), company_name, ...
 * auction_bids: id (uuid), auction_id (uuid), candidate_id (uuid NOT NULL),
 *              bidder_user_id (uuid), amount_cents (int8), created_at (timestamptz)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const AUCTION_ID = process.env.AUCTION_ID;

const COMPANY1_EMAIL = process.env.COMPANY1_EMAIL;
const COMPANY1_PASSWORD = process.env.COMPANY1_PASSWORD;

const COMPANY2_EMAIL = process.env.COMPANY2_EMAIL;
const COMPANY2_PASSWORD = process.env.COMPANY2_PASSWORD;

function reqEnv(name) {
  if (!process.env[name]) {
    console.error(`❌ ENV manquante: ${name}`);
    process.exit(1);
  }
}

[
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "AUCTION_ID",
  "COMPANY1_EMAIL",
  "COMPANY1_PASSWORD",
  "COMPANY2_EMAIL",
  "COMPANY2_PASSWORD",
].forEach(reqEnv);

function logTitle(t) {
  console.log("\n" + "=".repeat(80));
  console.log(t);
  console.log("=".repeat(80));
}

function fmtEuroFromCents(cents) {
  if (cents === null || cents === undefined) return "—";
  const eur = Number(cents) / 100;
  return `${eur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

async function signIn(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  if (!data?.session) throw new Error(`No session returned for ${email}`);

  return client;
}

async function getUid(client) {
  const { data: authData, error: authErr } = await client.auth.getUser();
  if (authErr) throw new Error(`auth.getUser error: ${authErr.message}`);
  const uid = authData?.user?.id;
  if (!uid) throw new Error("No auth user id (uid) found.");
  return uid;
}

async function ensureCandidate(client, companyNameHint) {
  // RLS INSERT policy: WITH CHECK (user_id = auth.uid()) -> on fournit user_id
  const uid = await getUid(client);

  const payload = {
    auction_id: AUCTION_ID,
    user_id: uid,
    company_name: companyNameHint,

    // optionnel (pour éviter des NOT NULL surprises si un jour tu les rends obligatoires)
    company_country: "FR",
    company_website: "https://example.com",
  };

  const { error } = await client.from("auction_candidates").insert(payload);

  if (!error) {
    console.log(`✅ Candidate OK (insert): ${companyNameHint}`);
    return;
  }

  // On tolère les erreurs de doublon/unique
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("already exists")) {
    console.log(`ℹ️ Candidate déjà existante (OK): ${companyNameHint}`);
    return;
  }

  throw new Error(`Candidate insert error (${companyNameHint}): ${error.message}`);
}

async function getMyCandidateId(client) {
  const uid = await getUid(client);

  const { data, error } = await client
    .from("auction_candidates")
    .select("id")
    .eq("auction_id", AUCTION_ID)
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`getMyCandidateId error: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Aucune candidature trouvée pour ce user sur cette enchère. (candidate_id introuvable)"
    );
  }

  return data[0].id;
}

async function getBestBid(client) {
  const { data, error } = await client
    .from("auction_bids")
    .select("amount_cents, created_at")
    .eq("auction_id", AUCTION_ID)
    .order("amount_cents", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(`getBestBid error: ${error.message}`);
  if (!data || data.length === 0) return null;
  return data[0];
}

async function placeBid(client, amountCents) {
  const uid = await getUid(client);
  const candidateId = await getMyCandidateId(client);

  // IMPORTANT:
  // - candidate_id est NOT NULL -> obligatoire
  // - bidder_user_id souvent contrôlé par RLS/trigger -> on met uid (valeur correcte)
  const payload = {
    auction_id: AUCTION_ID,
    candidate_id: candidateId,
    bidder_user_id: uid,
    amount_cents: amountCents,
  };

  const { data, error } = await client
    .from("auction_bids")
    .insert(payload)
    .select("id, amount_cents, created_at, candidate_id, bidder_user_id")
    .single();

  if (error) return { ok: false, error };
  return { ok: true, data };
}

async function main() {
  logTitle("TEST A — MISE PLUS BASSE QUE LA MEILLEURE (doit être BLOQUÉE)");

  console.log("➡️ Connexion entreprise1...");
  const c1 = await signIn(COMPANY1_EMAIL, COMPANY1_PASSWORD);

  console.log("➡️ Connexion entreprise2...");
  const c2 = await signIn(COMPANY2_EMAIL, COMPANY2_PASSWORD);

  console.log("\n➡️ Vérif/inscription candidates (si déjà candidates, c’est OK)...");
  await ensureCandidate(c1, "entreprise1");
  await ensureCandidate(c2, "entreprise2");

  console.log("\n➡️ Lecture best bid actuel...");
  const bestBefore = await getBestBid(c1);
  console.log("Best bid avant:", bestBefore ? fmtEuroFromCents(bestBefore.amount_cents) : "Aucun");

  // On force une meilleure mise via entreprise1 (en CENTIMES)
  // Si aucun best bid, on part de 1000€ => 100000 cents
  const baseAmountCents = bestBefore?.amount_cents ? Number(bestBefore.amount_cents) : 1000 * 100;
  const newBestCents = baseAmountCents + 1000 * 100; // +1000€

  console.log(`\n➡️ Entreprise1 pose une mise valide: ${fmtEuroFromCents(newBestCents)}`);
  const r1 = await placeBid(c1, newBestCents);
  if (!r1.ok) {
    console.error("❌ Échec mise valide (entreprise1):", r1.error.message);
    process.exit(1);
  }
  console.log("✅ Mise entreprise1 OK:", fmtEuroFromCents(r1.data.amount_cents));

  console.log("\n➡️ Vérif best bid après mise valide...");
  const bestAfter = await getBestBid(c1);
  console.log("Best bid après:", bestAfter ? fmtEuroFromCents(bestAfter.amount_cents) : "Aucun");

  // Maintenant entreprise2 essaie de miser plus bas (doit échouer)
  // -100€ => -10000 cents
  const lowerCents = newBestCents - 100 * 100;

  console.log(
    `\n➡️ Entreprise2 tente une mise plus basse: ${fmtEuroFromCents(lowerCents)} (doit être REFUSÉE)`
  );
  const r2 = await placeBid(c2, lowerCents);

  if (r2.ok) {
    console.error("❌ PROBLÈME: la mise plus basse a été acceptée, ce n’est pas normal.");
    console.log("Donnée insérée:", r2.data);
    process.exit(1);
  }

  console.log("✅ Refus attendu OK.");
  console.log("Message erreur (utile):", r2.error.message);

  console.log("\n🎯 Conclusion: si tu vois 'Refus attendu OK', le trigger 'strictly increasing' fait bien son job.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Crash script:", e.message);
  process.exit(1);
});
