export default function Card({children,className='',...rest}){return <section className={`card ${className}`} {...rest}>{children}</section>}
