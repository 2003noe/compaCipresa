import React from 'react';
export default function Button({children,variant='primary',size='md',icon:Icon,type='button',disabled=false,onClick,className=''}){return <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant} btn-${size} ${className}`}>{Icon&&<Icon size={size==='sm'?14:16}/>}<span>{children}</span></button>}
