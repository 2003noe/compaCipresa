export default function Input({label,icon:Icon,suffix,type='text',placeholder,required=false,...props}){
  return <div className="field">
    {label && <label className="field-label">{label}{required && <b> *</b>}</label>}
    <div className="input-shell">
      {Icon && <Icon className="input-icon" size={16} strokeWidth={1.7}/>} 
      <input className="input" type={type} placeholder={placeholder} required={required} {...props}/>
      {suffix && <button className="input-suffix" type="button">{suffix}</button>}
    </div>
  </div>
}
