import { useRef } from "react";

// Saisie d'un code à usage unique (OTP) : une case par chiffre.
// - value : chaîne de chiffres (ex. "123")
// - onChange(valeur) : appelé à chaque modification
// - onComplete(valeur) : appelé quand toutes les cases sont remplies
// Gère la saisie, le collage d'un code complet, Retour arrière et les flèches.
export default function OtpInput({
  value = "",
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = true,
  label = "Code de vérification",
}) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  const focusAt = (index) => {
    const target = refs.current[Math.max(0, Math.min(length - 1, index))];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const commit = (next) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange?.(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const handleChange = (index, event) => {
    const typed = event.target.value.replace(/\D/g, "");
    if (!typed) return;
    // Un chiffre saisi remplace la case ; plusieurs chiffres (autofill) se répartissent.
    const next = (value.slice(0, index) + typed + value.slice(index + typed.length)).slice(0, length);
    commit(next);
    focusAt(index + typed.length);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        focusAt(index - 1);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    commit(pasted);
    focusAt(pasted.length);
  };

  return (
    <div className="otp-field">
      <span className="field-label otp-label" id="otp-label">{label}</span>
      <div className="otp-row" role="group" aria-labelledby="otp-label">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { refs.current[index] = el; }}
            className="otp-box"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={length}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`Chiffre ${index + 1} sur ${length}`}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
