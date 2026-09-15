import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
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
      setAccessLoading(false);
      return;
    }

    if (!session?.user) {
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      setRolePermissions({});
      setAccessLoading(false);
      setAccessError(null);
      return;
    }

    let isMounted = true;

    async function loadAccess() {
      setAccessLoading(true);
      setAccessError(null);

      const [profileResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase
          .from("user_roles")
          .select("role:roles(id, code, nom, description)")
          .eq("user_id", session.user.id),
      ]);

      if (!isMounted) return;

      if (profileResult.error || rolesResult.error) {
        setAccessLoading(false);
        setAccessError((profileResult.error || rolesResult.error).message);
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setRolePermissions({});
        return;
      }

      const nextRoles = (rolesResult.data || [])
        .map(({ role }) => role)
        .filter(Boolean);
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

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp({ email, password, nom, prenom, telephone }) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nom, prenom, telephone },
      },
    });
    return { error };
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
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

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        roles,
        permissions,
        rolePermissions,
        accessError,
        accessLoading,
        loading,
        hasRole,
        can,
        updateProfile,
        signIn,
        signUp,
        resetPassword,
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
