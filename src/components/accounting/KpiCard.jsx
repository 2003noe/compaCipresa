import Card from '../ui/Card';
export default function KpiCard({label,value,change,positive=true,icon:Icon}){return <Card className="kpi-card"><div className="kpi-head"><span>{label}</span>{Icon&&<div className="kpi-icon"><Icon size={16}/></div>}</div><strong>{value}</strong><div className={`kpi-change ${positive?'positive':'negative'}`}>{positive?'↗':'↘'} {change}</div></Card>}
