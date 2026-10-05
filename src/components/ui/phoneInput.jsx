import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

function MyPhoneInput({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>

      <div className="input-shell" style={{ background: "#ffffff",paddingLeft:"8px", border: "none", outline: "none", borderRadius: "5px" }}>
        <PhoneInput
        style={{ border: "none", outline: "none"}}
        
          placeholder="+237 07 00 00 00 00"
          defaultCountry="cm"
          value={value}
          onChange={(phone) => onChange({ target: { value: phone } })}
        />
      </div>
    </div>
  );
}

export default MyPhoneInput;