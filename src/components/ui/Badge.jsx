const styles={Validée:'success',Brouillon:'warning','En attente':'neutral','En retard':'danger',Actif:'success',Inactif:'neutral',Clôturé:'neutral'};
export default function Badge({children,tone}){return <span className={`badge badge-${tone||styles[children]||'neutral'}`}>{children}</span>}
