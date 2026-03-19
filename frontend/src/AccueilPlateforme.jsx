import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./styles/accueil-plateforme.css";

const LEFT = [
  { name: "Banque", icon: "🏦", amount: "715 000 €", progress: 60 },
  { name: "Assurance", icon: "🧡", amount: "910 000 €", progress: 72 },
  { name: "Mutuelle", icon: "💛", amount: "935 000 €", progress: 75 },
  { name: "Carte paiement", icon: "💳", amount: "960 000 €", progress: 77 },
  { name: "Téléphonie", icon: "📱", amount: "1 240 000 €", progress: 90 },
];

const RIGHT = [
  { name: "Internet", icon: "🌐", amount: "845 000 €", progress: 65 },
  { name: "Recherche web", icon: "📶", amount: "1 420 000 €", progress: 82 },
  { name: "Gaz", icon: "🔥", amount: "490 000 €", progress: 46 },
  { name: "Électricité", icon: "⚡", amount: "780 000 €", progress: 61 },
  { name: "Streaming", icon: "🎬", amount: "820 000 €", progress: 64 },
];

function Card({ item, onClick }) {
  return (
    <button className="auction-card" onClick={onClick}>
      <div className="auction-card-sector">
        <span className="icon">{item.icon}</span>
        <span className="title">{item.name}</span>
      </div>

      <div className="auction-card-amount">{item.amount}</div>

      <div className="auction-card-progress">
        <div
          className="auction-card-bar"
          style={{ width: `${item.progress}%` }}
        />
      </div>
    </button>
  );
}

export default function AccueilPlateforme() {
  const navigate = useNavigate();

  function open(name) {
    navigate(`/encheres?sector=${encodeURIComponent(name)}`);
  }

  return (
    <div className="home">
      <header className="hero">
        <h1>Combien vaut votre fidélité ?</h1>

        <p className="hero-sub">Votre fidélité au plus offrant</p>

        <p className="hero-tag">
          <b>Et si votre fidélité finançait votre retraite et vos projets ?</b>
        </p>

        <div className="hero-buttons">
          <Link to="/register/consumer" className="btn-gold">
            Rejoindre la communauté
          </Link>

          {/* ✅ NOUVEAU BOUTON CENTRAL */}
          <Link to="/comment-ca-marche" className="btn-gold">
            Comment ça marche ?
          </Link>

          <Link to="/entreprise" className="btn-gold">
            Espace entreprise
          </Link>
        </div>

        <div className="stats">
          <div className="stat">
            👥 132 540
            <span>consommateurs</span>
          </div>

          <div className="stat">
            🤝 18 450
            <span>parrains</span>
          </div>

          <div className="stat">
            💼 176
            <span>entreprises</span>
          </div>

          <div className="stat">
            🪙 8 450 000 €
            <span>enchères</span>
          </div>
        </div>
      </header>

      <section className="title-section">
        <span className="line" />
        <h2>Les salles d’enchères de la communauté</h2>
        <span className="line" />
      </section>

      <main className="arena">
        <div className="column">
          {LEFT.map((s) => (
            <Card key={s.name} item={s} onClick={() => open(s.name)} />
          ))}
        </div>

        <div className="center">
          <img src="/images/home-center-cart.png" className="cart" />

          <div className="pot">
            Caisse totale
            <strong>8 450 000 €</strong>
          </div>
        </div>

        <div className="column">
          {RIGHT.map((s) => (
            <Card key={s.name} item={s} onClick={() => open(s.name)} />
          ))}
        </div>
      </main>
    </div>
  );
}