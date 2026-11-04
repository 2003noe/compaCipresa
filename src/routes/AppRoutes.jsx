import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import Dashboard from "../pages/dashboard/Dashboard";
import ChartOfAccounts from "../pages/accounting/ChartOfAccounts";
import JournalPage from "../pages/accounting/JournalPage";
import GrandLivre from "../pages/accounting/GrandLivre";
import Balance from "../pages/accounting/Balance";
import Bilan from "../pages/accounting/Bilan";
import CompteResultat from "../pages/accounting/CompteResultat";
import Tresorerie from "../pages/accounting/Tresorerie";
import LivreInventaire from "../pages/accounting/LivreInventaire";
import GenericAccountingPage from "../pages/accounting/GenericAccountingPage";
import Clotures from "../pages/accounting/Clotures";
import NewCloture from "../pages/accounting/NewCloture";
import ClotureDetail from "../pages/accounting/ClotureDetail";
import NewAccount from "../pages/accounting/NewAccount";
import NewEntry from "../pages/accounting/NewEntry";
import NewAsset from "../components/NewAsset";
import Immobilisations from "../components/Immobilisations";
import GenericNewForm from "../pages/accounting/GenericNewForm";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import Profile from "../pages/settings/Profile";
import Settings from "../pages/settings/Settings";
import Configuration from "../pages/settings/Configuration";
import FAQ from "../pages/FAQ";
import CompanyAnalytics from "../pages/admin/CompanyAnalytics";
import SyncVentes from "../pages/accounting/SyncVentes";
import { ROUTE_PERMISSIONS } from "../lib/rbac";

const inside = (Component, props, access) => (
  <ProtectedRoute access={access}>
    <AppLayout>
      <Component {...props} />
    </AppLayout>
  </ProtectedRoute>
);

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/connexion" replace />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Register />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
      <Route path="/dashboard" element={inside(Dashboard, undefined, ROUTE_PERMISSIONS.dashboard)} />
      <Route path="/plan-comptable" element={inside(ChartOfAccounts, undefined, ROUTE_PERMISSIONS.chart)} />
      <Route path="/journal" element={inside(JournalPage, undefined, ROUTE_PERMISSIONS.journal)} />
      <Route path="/grand-livre" element={inside(GrandLivre, undefined, ROUTE_PERMISSIONS.ledger)} />
      <Route path="/balance" element={inside(Balance, undefined, ROUTE_PERMISSIONS.reports)} />
      <Route path="/bilan" element={inside(Bilan, undefined, ROUTE_PERMISSIONS.reports)} />
      <Route path="/compte-resultat" element={inside(CompteResultat, undefined, ROUTE_PERMISSIONS.reports)} />
      <Route path="/tresorerie" element={inside(Tresorerie, undefined, ROUTE_PERMISSIONS.treasury)} />
      <Route path="/livre-inventaire" element={inside(LivreInventaire, undefined, ROUTE_PERMISSIONS.inventory)} />
      <Route path="/immobilisations" element={inside(Immobilisations, undefined, ROUTE_PERMISSIONS.assets)} />
      <Route path="/sync-ventes" element={inside(SyncVentes, undefined, ROUTE_PERMISSIONS.sales)} />
      <Route path="/clotures" element={inside(Clotures, undefined, ROUTE_PERMISSIONS.closures)} />
      <Route path="/clotures/:id" element={inside(ClotureDetail, undefined, ROUTE_PERMISSIONS.closures)} />
      <Route path="/parametres" element={inside(Settings, undefined, ROUTE_PERMISSIONS.settings)} />
      <Route path="/configuration" element={inside(Configuration, undefined, ROUTE_PERMISSIONS.users)} />
      <Route path="/administration/entreprises" element={inside(CompanyAnalytics, undefined, ROUTE_PERMISSIONS.analytics)} />
      <Route path="/faq" element={inside(FAQ, undefined, ROUTE_PERMISSIONS.help)} />
      <Route path="/profil" element={inside(Profile, undefined, ROUTE_PERMISSIONS.profile)} />
      <Route path="/nouvelle-ecriture" element={inside(NewEntry, undefined, ROUTE_PERMISSIONS.createEntry)} />
      <Route path="/nouveau-compte" element={inside(NewAccount, undefined, ROUTE_PERMISSIONS.createAccount)} />
      <Route
        path="/nouvelle-tresorerie"
        element={inside(GenericNewForm, { type: "treasury" }, ROUTE_PERMISSIONS.createEntry)}
      />
      <Route path="/nouvelle-cloture" element={inside(NewCloture, undefined, 'COMPTA_CLOTURE_PREPARE')} />
      <Route
        path="/nouveau-grand-livre"
        element={inside(GenericNewForm, { type: "grand" }, ROUTE_PERMISSIONS.noCreation)}
      />
      <Route
        path="/nouvelle-balance"
        element={inside(GenericNewForm, { type: "balance" }, ROUTE_PERMISSIONS.noCreation)}
      />
      <Route
        path="/nouveau-resultat"
        element={inside(GenericNewForm, { type: "result" }, ROUTE_PERMISSIONS.noCreation)}
      />
      <Route path="/nouvelle-immobilisation" element={inside(NewAsset, undefined, ROUTE_PERMISSIONS.createAsset)} />
      <Route path="*" element={<Navigate to="/connexion" replace />} />
    </Routes>
  );
}
