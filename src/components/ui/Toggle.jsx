import { useState } from 'react';
export default function Toggle({label,description,defaultChecked=false,checked,onChange,disabled=false}){
  const [internal,setInternal]=useState(defaultChecked);
  const isControlled=typeof checked==='boolean'; const on=isControlled?checked:internal;
  const toggle=()=>{if(disabled)return;if(onChange) onChange(!on); else setInternal(v=>!v)};
  return <button type="button" className={`toggle ${on?'toggle-on':''} ${disabled?'toggle-disabled':''}`} onClick={toggle} aria-pressed={on} disabled={disabled}><span className="toggle-knob"/><span><strong>{label}</strong>{description&&<small className="toggle-description">{description}</small>}</span></button>
}
