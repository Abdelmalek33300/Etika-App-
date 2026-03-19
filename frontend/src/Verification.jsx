import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/verification.css";

export default function Verification() {
  const navigate = useNavigate();

  const [method, setMethod] = useState("sms");
  const [step, setStep] = useState("choose"); // choose | code
  const [code, setCode] = useState("");

  const handleSendCode = () => {
    setStep("code");

    alert(method === "sms" ? "Code envoyé par SMS" : "Code envoyé par email");
  };

  const handleValidate = () => {
    if (!code.trim()) {
      alert("Veuillez entrer le code");
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div className="verification-page">
      <div className="verification-wrapper">
        <div className="verification-card">
          <h1 className="verification-title">Vérification</h1>

          <p className="verification-subtitle">
            Sécurisez votre compte en validant votre identité
          </p>

          {step === "choose" && (
            <>
              <div className="verification-methods">
                <button
                  type="button"
                  className={`verification-method-btn ${
                    method === "sms" ? "active" : ""
                  }`}
                  onClick={() => setMethod("sms")}
                >
                  SMS
                </button>

                <button
                  type="button"
                  className={`verification-method-btn ${
                    method === "email" ? "active" : ""
                  }`}
                  onClick={() => setMethod("email")}
                >
                  Email
                </button>
              </div>

              <div className="verification-actions">
                <button
                  type="button"
                  className="verification-main-btn"
                  onClick={handleSendCode}
                >
                  Envoyer le code
                </button>
              </div>
            </>
          )}

          {step === "code" && (
            <>
              <div className="verification-info">
                {method === "sms"
                  ? "Code envoyé par SMS"
                  : "Code envoyé par email"}
              </div>

              <input
                type="text"
                className="verification-input"
                placeholder={
                  method === "sms"
                    ? "Entrer le code SMS"
                    : "Entrer le code email"
                }
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />

              <div className="verification-actions">
                <button
                  type="button"
                  className="verification-main-btn"
                  onClick={handleValidate}
                >
                  Valider
                </button>

                <button
                  type="button"
                  className="verification-secondary-btn"
                  onClick={() => setStep("choose")}
                >
                  Modifier le canal
                </button>
              </div>

              <button
                type="button"
                className="verification-resend-btn"
                onClick={handleSendCode}
              >
                Renvoyer le code
              </button>
            </>
          )}
        </div>

        <div className="verification-back-link-wrapper">
          <button
            type="button"
            className="verification-back-link"
            onClick={() => navigate("/rejoindre")}
          >
            Retour à l’inscription
          </button>
        </div>
      </div>
    </div>
  );
}