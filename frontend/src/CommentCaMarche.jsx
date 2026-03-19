import { Link } from "react-router-dom";
import "./styles/encheres-public.css";

function ActionButton({ to, children, variant = "purple" }) {
  const isGold = variant === "gold";

  return (
    <Link
      to={to}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "170px",
        padding: "13px 22px",
        borderRadius: "14px",
        textDecoration: "none",
        fontWeight: "800",
        fontSize: "14px",
        color: isGold ? "#4b2000" : "#ffffff",
        background: isGold
          ? "linear-gradient(145deg, #ffc52c, #f2a900)"
          : "linear-gradient(145deg, #9333ea, #3b0764)",
        boxShadow: isGold
          ? "0 10px 24px rgba(242, 169, 0, 0.28)"
          : "0 10px 24px rgba(147, 51, 234, 0.28)",
        border: isGold ? "none" : "1px solid rgba(255,255,255,0.18)",
      }}
    >
      {children}
    </Link>
  );
}

export default function CommentCaMarche() {
  const violet = "#9333ea";
  const violetDark = "#3b0764";
  const violetLight = "#e9d5ff";

  const steps = [
    {
      number: "1",
      title: "Vous vous inscrivez",
      bullets: [
        "Vous recevez un jeton numérique multisectoriel",
        "Vous activez votre pouvoir de décision",
        "Vous sélectionnez vos secteurs",
        "Vous monétisez votre pouvoir décisionnaire",
      ],
      image: "/images/etape-1-inscription.png",
      alt: "Illustration étape 1 inscription",
    },
    {
      number: "2",
      title: "Les entreprises enchérissent",
      bullets: [
        "Votre fidélité devient un levier économique",
        "Les entreprises entrent en concurrence",
        "Pendant 6 mois, elles s’affrontent pour proposer la meilleure offre",
        "Un sponsor est sélectionné dans chaque secteur",
      ],
      image: "/images/etape-2-encheres.png",
      alt: "Illustration étape 2 enchères",
    },
    {
      number: "3",
      title: "La super cagnotte est constituée",
      bullets: [
        "Plus nous sommes nombreux, plus les enchères montent",
        "Une cagnotte collective est créée",
        "Elle appartient à la communauté",
        "Elle finance un nouveau modèle économique",
      ],
      image: "/images/etape-3-cagnotte-coffre.png",
      alt: "Illustration étape 3 cagnotte coffre",
    },
  ];

  return (
    <div className="ep-wrap">
      <main
        style={{
          maxWidth: "1350px",
          margin: "0 auto",
          padding: "18px",
          borderRadius: "22px",
          background: `
            radial-gradient(
              circle at 50% 12%,
              rgba(255,255,255,0.12),
              rgba(233,213,255,0.16) 12%,
              rgba(147,51,234,0.08) 24%,
              transparent 34%
            ),
            radial-gradient(
              circle at 50% 42%,
              rgba(233,213,255,0.10),
              rgba(147,51,234,0.06) 20%,
              transparent 34%
            ),
            linear-gradient(
              180deg,
              #3b0764 0%,
              #5b21b6 38%,
              #7c3aed 68%,
              #9333ea 100%
            )
          `,
          boxShadow: "0 18px 40px rgba(59, 7, 100, 0.20)",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: "18px", color: "#fff" }}>
          <h1 className="ep-title" style={{ margin: 0, color: "#ffffff" }}>
            Comment ça marche ?
          </h1>

          <p
            style={{
              marginTop: "6px",
              fontSize: "15px",
              fontWeight: "800",
              color: violetLight,
            }}
          >
            Monétisez le pouvoir du consommateur
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "22px",
          }}
        >
          {steps.map((step) => (
            <article
              key={step.number}
              style={{
                background:
                  "linear-gradient(160deg, rgba(147,51,234,0.72), rgba(59,7,100,0.72))",
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.16)",
                borderTop: `6px solid ${violetLight}`,
                boxShadow: "0 14px 32px rgba(20, 20, 40, 0.16)",
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                backdropFilter: "blur(6px)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "215px",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(233,213,255,0.16) 35%, rgba(255,255,255,0.04) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px",
                  boxSizing: "border-box",
                }}
              >
                <img
                  src={step.image}
                  alt={step.alt}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "center",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ padding: "18px", color: "#ffffff" }}>
                <div style={{ textAlign: "center", marginBottom: "10px" }}>
                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: "900",
                      color: "#ffd76b",
                      textShadow: "0 0 12px rgba(255, 215, 107, 0.25)",
                    }}
                  >
                    {step.number}
                  </div>
                </div>

                <h2
                  style={{
                    textAlign: "center",
                    marginBottom: "10px",
                    color: "#ffffff",
                  }}
                >
                  {step.title}
                </h2>

                <ul style={{ paddingLeft: "18px", margin: 0, color: "#f3e8ff" }}>
                  {step.bullets.map((b, i) => (
                    <li key={i} style={{ marginBottom: "6px" }}>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <ActionButton to="/">Accueil</ActionButton>
          <ActionButton to="/register/consumer" variant="gold">
            Rejoindre
          </ActionButton>
          <ActionButton to="/encheres">Enchères</ActionButton>
        </div>
      </main>
    </div>
  );
}