import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import Dashboard from '../pages/dashboard/Dashboard';
import ChartOfAccounts from '../pages/accounting/ChartOfAccounts';
import GenericAccountingPage from '../pages/accounting/GenericAccountingPage';
import NewAccount from '../pages/accounting/NewAccount';
import NewEntry from '../pages/accounting/NewEntry';
import NewAsset from '../pages/assets/NewAsset';
import GenericNewForm from '../pages/accounting/GenericNewForm';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import Profile from '../pages/settings/Profile';
import Settings from '../pages/settings/Settings';

const inside = (Component, props) => <ProtectedRoute><AppLayout><Component {...props} /></AppLayout></ProtectedRoute>;

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/connexion" replace />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/dashboard" element={inside(Dashboard)} />
      <Route path="/plan-comptable" element={inside(ChartOfAccounts)} />
      <Route path="/journal" element={inside(GenericAccountingPage, { type: 'journal' })} />
      <Route path="/grand-livre" element={inside(GenericAccountingPage, { type: 'grand' })} />
      <Route path="/balance" element={inside(GenericAccountingPage, { type: 'balance' })} />
      <Route path="/bilan" element={inside(GenericAccountingPage, { type: 'bilan' })} />
      <Route path="/compte-resultat" element={inside(GenericAccountingPage, { type: 'result' })} />
      <Route path="/tresorerie" element={inside(GenericAccountingPage, { type: 'treasury' })} />
      <Route path="/rapprochement" element={inside(GenericAccountingPage, { type: 'bank' })} />
      <Route path="/tva-taxes" element={inside(GenericAccountingPage, { type: 'tax' })} />
      <Route path="/immobilisations" element={inside(GenericAccountingPage, { type: 'assets' })} />
      <Route path="/clotures" element={inside(GenericAccountingPage, { type: 'closing' })} />
      <Route path="/parametres" element={inside(Settings)} />
      <Route path="/profil" element={inside(Profile)} />
      <Route path="/nouvelle-ecriture" element={inside(NewEntry)} />
      <Route path="/nouveau-compte" element={inside(NewAccount)} />
      <Route path="/nouvelle-tresorerie" element={inside(GenericNewForm, {type:'treasury'})} />
      <Route path="/nouveau-rapprochement" element={inside(GenericNewForm, {type:'bank'})} />
      <Route path="/nouvelle-tva" element={inside(GenericNewForm, {type:'tax'})} />
      <Route path="/nouvelle-cloture" element={inside(GenericNewForm, {type:'closing'})} />
      <Route path="/nouveau-grand-livre" element={inside(GenericNewForm, {type:'grand'})} />
      <Route path="/nouvelle-balance" element={inside(GenericNewForm, {type:'balance'})} />
      <Route path="/nouveau-resultat" element={inside(GenericNewForm, {type:'result'})} />
      <Route path="/nouvelle-immobilisation" element={inside(NewAsset)} />
      <Route path="*" element={<Navigate to="/connexion" replace />} />
    </Routes>
  );
}
