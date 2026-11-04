// Access gates reflected in RBAC.pdf. Permission checks are scoped to the
// currently selected company by AuthContext; the database remains authoritative.
export const ROUTE_PERMISSIONS = {
  dashboard: ['COMPTA_READ', 'SALES_READ'],
  chart: ['COMPTA_READ'],
  journal: ['COMPTA_READ'],
  ledger: ['COMPTA_READ'],
  reports: ['COMPTA_READ'],
  treasury: ['COMPTA_READ'],
  inventory: ['COMPTA_READ', 'STOCK_INVENTORY'],
  assets: ['COMPTA_READ', 'STOCK_INVENTORY'],
  sales: ['SALES_READ', 'COMPTA_READ'],
  closures: ['COMPTA_READ'],
  settings: ['CONFIG_COMPANY', 'COMPTA_READ'],
  users: ['CONFIG_USERS'],
  analytics: ['PLATFORM_ADMIN'],
  profile: [],
  help: [],
  createEntry: ['COMPTA_CREATE'],
  createAccount: ['COMPTA_CREATE', 'COMPTA_ACCOUNT_CREATE'],
  createAsset: ['COMPTA_ASSET_EDIT'],
  createClosure: ['COMPTA_CLOTURE_PREPARE'],
  noCreation: ['__NO_ROLE__'],
};

export function canAccessRoute(access, { can, hasRole }) {
  if (!access) return true;
  if (access === 'PLATFORM_ADMIN') return hasRole('ADMIN');
  if (Array.isArray(access)) {
    return access.length === 0 || access.some((permission) => (
      permission === 'PLATFORM_ADMIN' ? hasRole('ADMIN') : can(permission)
    ));
  }
  return can(access);
}
