import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/rejoindre.css";

export default function RejoindreCommunaute() {
  const navigate = useNavigate();
  const [selectedSectors, setSelectedSectors] = useState([]);

  const sectorFamilies = [
    {
      key: "finance",
      title: "Finance",
      items: [
        "Banque",
        "Assurance",
        "Mutuelle",
        "Carte de paiement",
      ],
    },
    {
      key: "telecom",
      title: "Télécom",
      items: [
        "Téléphonie mobile",
        "Box Internet",
        "VOD",
        "Moteur de recherche",
      ],
    },
    {
      key: "energie",
      title: "Énergie",
      items: ["Électricité", "Gaz"],
    },
  ];

  const toggleSector = (sector) => {
    setSelectedSectors((prev) =>
      prev.includes(sector)
        ? prev.filter((item) => item !== sector)
        : [...prev, sector]
    );
  };

  return (
    <div className="join-page">
      <div className="join-wrapper">
        <h1 className="join-title">Rejoindre la communauté</h1>

        <div className="join-panel">
          <section className="form-section">
            <input type="text" placeholder="Nom" autoComplete="off" />
            <input type="text" placeholder="Prénom" autoComplete="off" />
            <input type="email" placeholder="Email" autoComplete="off" />
            <input
              type="password"
              placeholder="Créer un mot de passe"
              autoComplete="new-password"
            />
            <input type="text" placeholder="Adresse" autoComplete="off" />

            <div className="row">
              <input
                type="text"
                placeholder="Code postal"
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength={5}
                autoComplete="off"
              />
              <input type="text" placeholder="Ville" autoComplete="off" />
            </div>

            <select defaultValue="">
              <option value="" disabled>
                Pays
              </option>
              <option value="France">France</option>
              <option value="Belgique">Belgique</option>
              <option value="Suisse">Suisse</option>
              <option value="Luxembourg">Luxembourg</option>
              <option value="Canada">Canada</option>
            </select>

            <input type="tel" placeholder="Téléphone" autoComplete="off" />

            <p className="privacy">
              🔒 Vos données sont protégées. La vérification du compte se fera à
              l’étape suivante.
            </p>

            <div className="form-footer">
              <button
                type="button"
                className="join-button"
                onClick={() => navigate("/verification")}
              >
                Rejoindre maintenant
              </button>

              <div className="form-links">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => navigate("/")}
                >
                  Accueil
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => navigate("/comment-ca-marche")}
                >
                  Comment ça marche
                </button>
              </div>
            </div>
          </section>

          <section className="sector-section">
            <div className="sector-header">
              <h2>Secteurs</h2>
              <span>{selectedSectors.length} sélectionné(s)</span>
            </div>

            <div className="sector-columns">
              {sectorFamilies.map((family) => (
                <div key={family.key} className="sector-family">
                  <h4>{family.title}</h4>

                  <div className="sector-family-list">
                    {family.items.map((sector) => {
                      const isActive = selectedSectors.includes(sector);

                      return (
                        <button
                          key={sector}
                          type="button"
                          className={`sector-item ${isActive ? "active" : ""}`}
                          onClick={() => toggleSector(sector)}
                          aria-pressed={isActive}
                        >
                          <span className="radio" aria-hidden="true" />
                          <span className="sector-label">{sector}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}