import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Phone,
  UserRound,
  EyeIcon,
  EyeClosedIcon,
} from "lucide-react";
import AuthLayout from "./AuthLayout";
import Input from "../../components/ui/Input";
import OtpInput from "../../components/ui/OtpInput";
import Button from "../../components/ui/Button";
import useCountdown from "../../hooks/useCountdown";
import { useAuth } from "../../context/AuthContext";
import MyPhoneInput from "../../components/ui/phoneInput";

const OTP_LENGTH = 6;
const RESEND_DELAY = 60; // Supabase impose 60 s minimum entre deux envois

export default function Register() {
  const nav = useNavigate();
  const { signUp, verifySignupOtp, resendSignupOtp, signOut } = useAuth();
  const [step, setStep] = useState("form"); // "form" -> "otp"
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, startCountdown] = useCountdown(RESEND_DELAY);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  // Étape 1 : création du compte, Supabase envoie le code par e-mail.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    const [prenom, ...rest] = form.fullName.trim().split(/\s+/);
    const nom = rest.join(" ") || prenom;
    const email = form.email.trim();

    setSubmitting(true);
    const { data, error: signUpError } = await signUp({
      email,
      password: form.password,
      nom,
      prenom,
      telephone: form.phone,
    });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Si "Confirm email" est désactivé côté Supabase, une session existe déjà : pas de code à saisir.
    if (data?.session) {
      await signOut();
      nav("/connexion", {
        replace: true,
        state: { registered: true, registeredEmail: email },
      });
      return;
    }

    setForm((f) => ({ ...f, email }));
    setCode("");
    setStep("otp");
    startCountdown(RESEND_DELAY);
  };




  

  // Étape 2 : vérification du code.
  const verifyCode = async (value = code) => {
    if (submitting) return;
    setError("");
    setInfo("");
    if (value.length !== OTP_LENGTH) {
      setError(`Saisissez le code à ${OTP_LENGTH} chiffres reçu par e-mail.`);
      return;
    }
    setSubmitting(true);
    const { error: verifyError } = await verifySignupOtp(form.email, value);
    if (verifyError) {
      setSubmitting(false);
      setCode("");
      setError(
        "Code invalide ou expiré. Vérifiez-le ou demandez un nouveau code.",
      );
      return;
    }
    // La vérification ouvre une session : on la ferme pour revenir à l'écran de connexion.
    await signOut();
    setSubmitting(false);
    nav("/connexion", {
      replace: true,
      state: { registered: true, registeredEmail: form.email },
    });
  };

  const resendCode = async () => {
    if (secondsLeft > 0 || submitting) return;
    setError("");
    setInfo("");
    const { error: resendError } = await resendSignupOtp(form.email);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setCode("");
    setInfo("Un nouveau code vient d'être envoyé.");
    startCountdown(RESEND_DELAY);
  };

  if (step === "otp") {
    return (
      <AuthLayout
        title="Vérifiez votre e-mail"
        subtitle="Un code de vérification vient de vous être envoyé."
      >
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className="auth-success" role="status">
            {info}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyCode();
          }}
        >
          <p className="otp-help">
            Saisissez le code à {OTP_LENGTH} chiffres envoyé à{" "}
            <strong>{form.email}</strong>.
          </p>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={verifyCode}
            length={OTP_LENGTH}
            disabled={submitting}
          />
          <Button
            type="submit"
            disabled={submitting || code.length !== OTP_LENGTH}
            className="w-full auth-submit"
          >
            {submitting ? "Vérification…" : "Vérifier et créer mon compte"}
          </Button>
        </form>
        <div className="otp-actions">
          <button
            type="button"
            className="text-button"
            onClick={resendCode}
            disabled={secondsLeft > 0 || submitting}
          >
            {secondsLeft > 0
              ? `Renvoyer le code (${secondsLeft} s)`
              : "Renvoyer le code"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setStep("form");
              setError("");
              setInfo("");
            }}
          >
            Modifier l'adresse e-mail
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez CIPRESA Comptabilité"
    >
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="auth-form-grid bg-red">
          <Input
            icon={UserRound}
            label="Nom complet"
            placeholder="Koffi Kouamé"
            required
            value={form.fullName}
            onChange={update("fullName")}
          />
          <Input
            icon={Mail}
            label="Email professionnel"
            type="email"
            placeholder="comptable@cipresa.ci"
            required
            value={form.email}
            onChange={update("email")}
          />
          <MyPhoneInput
            icon={Phone}
            label="Téléphone"
            placeholder="+225 07 00 00 00 00"
            value={form.phone}
            onChange={update("phone")}
          />
          <PasswordField
            label="Mot de passe"
            value={form.password}
            onChange={update("password")}
          />
          <PasswordField
            label="Confirmer le mot de passe"
            value={form.confirmPassword}
            onChange={update("confirmPassword")}
          />
        </div>
        <label className="terms-label">
          <input type="checkbox" required />
          <span>
            J'accepte les conditions d'utilisation et la politique de
            confidentialité de CIPRESA Consulting SARL
          </span>
        </label>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full auth-submit"
        >
          {submitting ? "Envoi du code…" : "Créer mon compte"}
        </Button>
      </form>
      <div className="auth-divider" />
      <div className="auth-footer">
        Déjà un compte ? <Link to="/connexion">Se connecter</Link>
      </div>
      <p className="auth-subtitle" style={{ marginTop: 12, fontSize: 12 }}>
        Le rôle (Comptable, Gérant…) est attribué par un administrateur après
        l'inscription.
      </p>
    </AuthLayout>
  );
}

function PasswordField({ label, value, onChange }) {
  const [isView, setIsview] = useState(false);
  return (
    <Input
      icon={Lock}
      label={label}
      type={isView ? "text" : "password"}
      placeholder="••••••••••••"
      suffix={
        <span onClick={() => setIsview(!isView)}>
          {isView ? <EyeIcon /> : <EyeClosedIcon />}
        </span>
      }
      required
      value={value}
      onChange={onChange}
      minLength={6}
    />
  );
}
