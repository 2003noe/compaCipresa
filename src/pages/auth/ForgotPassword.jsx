import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, EyeIcon, EyeClosedIcon } from "lucide-react";
import AuthLayout from "./AuthLayout";
import Input from "../../components/ui/Input";
import OtpInput from "../../components/ui/OtpInput";
import Button from "../../components/ui/Button";
import useCountdown from "../../hooks/useCountdown";
import { useAuth } from "../../context/AuthContext";

const OTP_LENGTH = 6;
const RESEND_DELAY = 60;
const MIN_PASSWORD = 6;

export default function ForgotPassword() {
  const nav = useNavigate();
  const { resetPassword, verifyRecoveryOtp, updatePassword, signOut } = useAuth();
  const [step, setStep] = useState("email"); // "email" -> "otp" -> "password"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, startCountdown] = useCountdown(RESEND_DELAY);

  // Étape 1 : envoi du code. Message volontairement neutre (ne révèle pas si l'e-mail existe).
  const sendCode = async (event) => {
    event?.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    const { error: resetError } = await resetPassword(email.trim());
    setSubmitting(false);
    if (resetError) { setError(resetError.message); return; }
    setEmail(email.trim());
    setCode("");
    setStep("otp");
    startCountdown(RESEND_DELAY);
  };

  const resendCode = async () => {
    if (secondsLeft > 0 || submitting) return;
    setError("");
    const { error: resetError } = await resetPassword(email);
    if (resetError) { setError(resetError.message); return; }
    setCode("");
    setInfo("Si cette adresse correspond à un compte, un nouveau code vient d'être envoyé.");
    startCountdown(RESEND_DELAY);
  };

  // Étape 2 : vérification du code (ouvre une session temporaire côté Supabase).
  const verifyCode = async (value = code) => {
    if (submitting) return;
    setError("");
    setInfo("");
    if (value.length !== OTP_LENGTH) {
      setError(`Saisissez le code à ${OTP_LENGTH} chiffres reçu par e-mail.`);
      return;
    }
    setSubmitting(true);
    const { error: verifyError } = await verifyRecoveryOtp(email, value);
    setSubmitting(false);
    if (verifyError) {
      setCode("");
      setError("Code invalide ou expiré. Vérifiez-le ou demandez un nouveau code.");
      return;
    }
    setStep("password");
  };

  // Étape 3 : nouveau mot de passe, puis retour à la connexion.
  const savePassword = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD) { setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    if (updateError) { setSubmitting(false); setError(updateError.message); return; }
    await signOut();
    setSubmitting(false);
    nav("/connexion", { replace: true, state: { passwordReset: true } });
  };

  if (step === "otp") {
    return (
      <AuthLayout title="Saisissez le code" subtitle="Vérifiez votre boîte de réception.">
        {error && <div className="message error" role="alert">{error}</div>}
        {info && <div className="auth-success" role="status">{info}</div>}
        <form onSubmit={(e) => { e.preventDefault(); verifyCode(); }}>
          <p className="otp-help">
            Si <strong>{email}</strong> correspond à un compte, un code à {OTP_LENGTH} chiffres vient d'y être envoyé.
          </p>
          <OtpInput value={code} onChange={setCode} onComplete={verifyCode} length={OTP_LENGTH} disabled={submitting} />
          <Button type="submit" disabled={submitting || code.length !== OTP_LENGTH} className="w-full">
            {submitting ? "Vérification…" : "Vérifier le code"}
          </Button>
        </form>
        <div className="otp-actions">
          <button type="button" className="text-button" onClick={resendCode} disabled={secondsLeft > 0 || submitting}>
            {secondsLeft > 0 ? `Renvoyer le code (${secondsLeft} s)` : "Renvoyer le code"}
          </button>
          <button type="button" className="text-button" onClick={() => { setStep("email"); setError(""); setInfo(""); }}>
            Changer d'adresse e-mail
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (step === "password") {
    return (
      <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez un mot de passe d'au moins 8 caractères.">
        {error && <div className="message error" role="alert">{error}</div>}
        <form onSubmit={savePassword}>
          <Input
            icon={Lock}
            label="Nouveau mot de passe"
            type={showPwd ? "text" : "password"}
            placeholder="••••••••••••"
            suffix={<span onClick={() => setShowPwd(!showPwd)}>{showPwd ? <EyeIcon /> : <EyeClosedIcon />}</span>}
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            icon={Lock}
            label="Confirmer le mot de passe"
            type={showPwd ? "text" : "password"}
            placeholder="••••••••••••"
            required
            minLength={MIN_PASSWORD}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Recevez un code de réinitialisation par e-mail.">
      {error && <div className="message error" role="alert">{error}</div>}
      <form onSubmit={sendCode}>
        <Input label="Adresse e-mail" type="email" placeholder="comptable@cipresa.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={submitting} className="w-full">{submitting ? "Envoi…" : "Envoyer le code"}</Button>
      </form>
      <div className="auth-footer"><Link to="/connexion">← Retour à la connexion</Link></div>
    </AuthLayout>
  );
}
