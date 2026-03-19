import { Routes, Route, Navigate } from "react-router-dom";
import EntrepriseDashboard from "./EntrepriseDashboard";
import EntrepriseEncherir from "./EntrepriseEncherir";

/**
 * EntrepriseApp.jsx — shell minimal (sans header / sans nav)
 * Objectif :
 * - Éviter tout doublon UX (le Dashboard gère l'affichage)
 * - Garder uniquement le routage entreprise
 * Routes conservées :
 * /entreprise               -> EntrepriseDashboard
 * /entreprise/encheres      -> EntrepriseEncherir (comportement actuel)
 * /entreprise/encherir/:id  -> EntrepriseEncherir (action ciblée)
 */
export default function EntrepriseApp() {
  return (
    <Routes>
      <Route path="/" element={<EntrepriseDashboard />} />

      {/* Liste privée (comportement actuel) */}
      <Route path="/encheres" element={<EntrepriseEncherir />} />

      {/* Action ciblée depuis la salle publique */}
      <Route path="/encherir/:auctionId" element={<EntrepriseEncherir />} />

      <Route path="*" element={<Navigate to="/entreprise" replace />} />
    </Routes>
  );
}