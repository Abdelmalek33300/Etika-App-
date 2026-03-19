import { Routes, Route, Navigate } from "react-router-dom";

import AccueilPlateforme from "./AccueilPlateforme";
import AdminApp from "./AdminApp";
import EntrepriseApp from "./EntrepriseApp";
import EncheresPublic from "./EncheresPublic";
import EnchereDetail from "./EnchereDetail";

// Pages
import CommentCaMarche from "./CommentCaMarche";
import RejoindreCommunaute from "./RejoindreCommunaute";
import Verification from "./Verification"; // ✅ AJOUT

export default function App() {
  return (
    <Routes>
      {/* Entrée centrale */}
      <Route path="/" element={<AccueilPlateforme />} />

      {/* Public */}
      <Route path="/encheres" element={<EncheresPublic />} />
      <Route path="/encheres/:auctionId" element={<EnchereDetail />} />

      {/* Pages info */}
      <Route path="/comment-ca-marche" element={<CommentCaMarche />} />
      <Route path="/rejoindre" element={<RejoindreCommunaute />} />
      <Route path="/verification" element={<Verification />} /> {/* ✅ AJOUT */}

      {/* Admin */}
      <Route path="/admin/*" element={<AdminApp />} />

      {/* Entreprise */}
      <Route path="/entreprise/*" element={<EntrepriseApp />} />

      {/* Compat */}
      <Route path="/business/*" element={<Navigate to="/entreprise" replace />} />
      <Route
        path="/entreprise/encherir"
        element={<Navigate to="/entreprise/encheres" replace />}
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}