import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";
import { companiesService } from "../services/companies";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [companies, setCompanies] = useState([]);
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      setRolePermissions({});
      setCompanies([]);
      setSelectedEntrepriseId("");
      setAccessLoading(false);
      return;
    }

    if (!session?.user) {
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      setRolePermissions({});
      setCompanies([]);
      setSelectedEntrepriseId("");
      setAccessLoading(false);
      setAccessError(null);
      return;
    }

    let isMounted = true;

    async function loadAccess() {
      setAccessLoading(true);
      setAccessError(null);

      const [profileResult, membershipsResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        companiesService.listMemberships(session.user.id),
      ]);

      if (!isMounted) return;

      if (profileResult.error || membershipsResult.error) {
        setAccessLoading(false);
        setAccessError((profileResult.error || membershipsResult.error).message);
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setRolePermissions({});
        return;
      }

      const memberships = membershipsResult.data || [];
      const companiesById = new Map();
      memberships.forEach((m) => {
        if (!m.entreprise) return;
        const company = companiesById.get(m.entreprise_id) || { ...m.entreprise, roles: [] };
        if (m.role && !company.roles.some((r) => r.id === m.role.id)) company.roles.push(m.role);
        companiesById.set(m.entreprise_id, company);
      });
      const nextCompanies = [...companiesById.values()];
      const storedId = profileResult.data?.active_entreprise_id || "";
      const nextCompanyId = nextCompanies.some((c) => c.id === storedId) ? storedId : (nextCompanies[0]?.id || "");
      const nextRoles = memberships.filter((m) => m.entreprise_id === nextCompanyId).map(({ role }) => role).filter(Boolean);
      const roleIds = nextRoles.map(({ id }) => id);
      let nextPermissions = [];
      const nextRolePermissions = {};

      if (roleIds.length) {
        const { data, error } = await supabase
          .from("role_permissions")
          .select("role_id, permission:permissions(code, nom, description)")
          .in("role_id", roleIds);

        if (error) {
          setAccessLoading(false);
          setAccessError(error.message);
          setProfile(null);
          setRoles([]);
          setPermissions([]);
          setRolePermissions({});
          return;
        }

        (data || []).forEach(({ role_id, permission }) => {
          if (!permission?.code) return;
          if (!nextRolePermissions[role_id]) nextRolePermissions[role_id] = [];
          nextRolePermissions[role_id].push(permission);
        });
        nextPermissions = [...new Set(Object.values(nextRolePermissions).flat().map(({ code }) => code))];
      }

      setProfile(profileResult.data);
      setCompanies(nextCompanies);
      setSelectedEntrepriseId(nextCompanyId);
      setRoles(nextRoles);
      setPermissions(nextPermissions);
      setRolePermissions(nextRolePermissions);
      setAccessLoading(false);
    }

    loadAccess();
    return () => {
      isMounted = false;
    };
  }, [session]);

  async function switchEntreprise(id) {
    if (!companies.some((company) => company.id === id)) return { error: { message: "Vous n’êtes pas membre de cette entreprise." } };
    const { error } = await companiesService.setActive(id);
    if (error) return { error };
    setSelectedEntrepriseId(id);
    const membership = companies.find((company) => company.id === id);
    const nextRoles = membership?.roles || [];
    const roleIds = nextRoles.map((role) => role.id);
    const { data, error: permissionError } = roleIds.length
      ? await supabase.from("role_permissions").select("role_id,permission:permissions(code,nom,description)").in("role_id", roleIds)
      : { data: [], error: null };
    if (permissionError) return { error: permissionError };
    const grouped = {};
    (data || []).forEach(({ role_id, permission }) => { if (permission?.code) (grouped[role_id] ||= []).push(permission); });
    setRoles(nextRoles);
    setRolePermissions(grouped);
    setPermissions([...new Set(Object.values(grouped).flat().map((p) => p.code))]);
    setProfile((p) => p ? { ...p, active_entreprise_id: id } : p);
    return { error: null };
  }

  async function createCompany(name) {
    if (!roles.some((role) => role.code === "ADMIN")) return { error: { message: "Seul un administrateur peut créer une entreprise." } };
    const { data: newCompanyId, error: createError } = await companiesService.provision(name.trim());
    if (createError) return { error: createError };

    const { data: memberships, error: membershipError } = await companiesService.listMemberships(session?.user?.id);
    if (membershipError) return { error: membershipError };
    const nextCompaniesById = new Map();
    (memberships || []).forEach((membership) => {
      if (!membership.entreprise) return;
      const company = nextCompaniesById.get(membership.entreprise_id) || { ...membership.entreprise, roles: [] };
      if (membership.role && !company.roles.some((role) => role.id === membership.role.id)) company.roles.push(membership.role);
      nextCompaniesById.set(membership.entreprise_id, company);
    });
    const nextCompanies = [...nextCompaniesById.values()];
    const membership = memberships?.filter((item) => item.entreprise_id === newCompanyId) || [];
    const nextRoles = membership.map((item) => item.role).filter(Boolean);
    const roleIds = nextRoles.map((role) => role.id);
    const { data, error: permissionError } = roleIds.length
      ? await supabase.from("role_permissions").select("role_id,permission:permissions(code,nom,description)").in("role_id", roleIds)
      : { data: [], error: null };
    if (permissionError) return { error: permissionError };
    const grouped = {};
    (data || []).forEach(({ role_id, permission }) => { if (permission?.code) (grouped[role_id] ||= []).push(permission); });

    setCompanies(nextCompanies);
    setSelectedEntrepriseId(newCompanyId);
    setRoles(nextRoles);
    setRolePermissions(grouped);
    setPermissions([...new Set(Object.values(grouped).flat().map((permission) => permission.code))]);
    setProfile((current) => current ? { ...current, active_entreprise_id: newCompanyId } : current);
    return { error: null };
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  // --- Inscription avec vérification de l'e-mail par code (OTP) ---
  // Prérequis Supabase : "Confirm email" activé + template "Confirm signup" avec {{ .Token }}.
  async function signUp({ email, password, nom, prenom, telephone, entreprise }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nom, prenom, telephone, entreprise_nom: entreprise },
      },
    });
    // Supabase ne renvoie pas d'erreur si l'e-mail existe déjà et est confirmé :
    // il renvoie un utilisateur sans identité. On le détecte pour informer l'utilisateur.
    if (!error && data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { data, error: { message: "Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez votre mot de passe." } };
    }
    return { data, error };
  }

  async function verifySignupOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    if (error) return { data, error };
    const entrepriseName = data?.user?.user_metadata?.entreprise_nom;
    if (entrepriseName) {
      const { error: provisionError } = await companiesService.provision(entrepriseName);
      if (provisionError) return { data, error: provisionError };
    }
    return { data, error: null };
  }

  async function resendSignupOtp(email) {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error };
  }

  // --- Mot de passe oublié avec code (OTP) ---
  // Prérequis Supabase : template "Reset password" avec {{ .Token }}.
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  }

  // Valide le code ; en cas de succès, Supabase ouvre une session temporaire
  // qui autorise ensuite updatePassword().
  async function verifyRecoveryOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
    return { data, error };
  }

  async function updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function hasRole(roleCode) {
    return roles.some(({ code }) => code === roleCode);
  }

  function can(permissionCode) {
    return permissions.includes(permissionCode);
  }

  function updateProfile(nextProfile) {
    setProfile(nextProfile);
  }

  function updateCompanyName(id, nom) {
    setCompanies((items) => items.map((company) => company.id === id ? { ...company, nom } : company));
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        roles,
        permissions,
        rolePermissions,
        companies,
        selectedEntrepriseId,
        selectedEntreprise: companies.find((company) => company.id === selectedEntrepriseId) || null,
        switchEntreprise,
        createCompany,
        accessError,
        accessLoading,
        loading,
        hasRole,
        can,
        updateProfile,
        updateCompanyName,
        signIn,
        signUp,
        verifySignupOtp,
        resendSignupOtp,
        resetPassword,
        verifyRecoveryOtp,
        updatePassword,
        provisionCompany: companiesService.provision,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  return ctx;
}
