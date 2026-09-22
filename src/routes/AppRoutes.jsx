import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import Dashboard from '../pages/dashboard/Dashboard';
import ChartOfAccounts from '../pages/accounting/ChartOfAccounts';
import JournalPage from '../pages/accounting/JournalPage';
import GrandLivre from '../pages/accounting/GrandLivre';
import Balance from '../pages/accounting/Balance';
import Bilan from '../pages/accounting/Bilan';
import CompteResultat from '../pages/accounting/CompteResultat';
import Tresorerie from '../pages/accounting/Tresorerie';
import Rapprochement from '../pages/accounting/Rapprochement';
import GenericAccountingPage from '../pages/accounting/GenericAccountingPage';
import TvaTaxes from '../pages/accounting/TvaTaxes';
import NewTvaDeclaration from '../pages/accounting/NewTvaDeclaration';
import TvaDeclarationDetail from '../pages/accounting/TvaDeclarationDetail';
import Clotures from '../pages/accounting/Clotures';
import NewCloture from '../pages/accounting/NewCloture';
import ClotureDetail from '../pages/accounting/ClotureDetail';
import NewAccount from '../pages/accounting/NewAccount';
import NewEntry from '../pages/accounting/NewEntry';
import NewAsset from '../pages/assets/NewAsset';
import Immobilisations from '../pages/assets/Immobilisations';
import GenericNewForm from '../pages/accounting/GenericNewForm';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import Profile from '../pages/settings/Profile';
import Settings from '../pages/settings/Settings';
import Configuration from '../pages/settings/Configuration';

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
      <Route path="/journal" element={inside(JournalPage)} />
      <Route path="/grand-livre" element={inside(GrandLivre)} />
      <Route path="/balance" element={inside(Balance)} />
      <Route path="/bilan" element={inside(Bilan)} />
      <Route path="/compte-resultat" element={inside(CompteResultat)} />
      <Route path="/tresorerie" element={inside(Tresorerie)} />
      <Route path="/rapprochement" element={inside(Rapprochement)} />
      <Route path="/tva-taxes" element={inside(TvaTaxes)} />
      <Route path="/tva-taxes/:id" element={inside(TvaDeclarationDetail)} />
      <Route path="/immobilisations" element={inside(Immobilisations)} />
      <Route path="/clotures" element={inside(Clotures)} />
      <Route path="/clotures/:id" element={inside(ClotureDetail)} />
      <Route path="/parametres" element={inside(Settings)} />
      <Route path="/configuration" element={inside(Configuration)} />
      <Route path="/profil" element={inside(Profile)} />
      <Route path="/nouvelle-ecriture" element={inside(NewEntry)} />
      <Route path="/nouveau-compte" element={inside(NewAccount)} />
      <Route path="/nouvelle-tresorerie" element={inside(GenericNewForm, {type:'treasury'})} />
      <Route path="/nouveau-rapprochement" element={inside(GenericNewForm, {type:'bank'})} />
      <Route path="/nouvelle-tva" element={inside(NewTvaDeclaration)} />
      <Route path="/nouvelle-cloture" element={inside(NewCloture)} />
      <Route path="/nouveau-grand-livre" element={inside(GenericNewForm, {type:'grand'})} />
      <Route path="/nouvelle-balance" element={inside(GenericNewForm, {type:'balance'})} />
      <Route path="/nouveau-resultat" element={inside(GenericNewForm, {type:'result'})} />
      <Route path="/nouvelle-immobilisation" element={inside(NewAsset)} />
      <Route path="*" element={<Navigate to="/connexion" replace />} />
    </Routes>
  );
}
