import { supabase } from '../../lib/supabaseClient';

/**
 * Contrôleur métier pour la gestion des comptes comptables (Chart of Accounts).
 * Gère les vérifications d'intégrité comptable, les contraintes d'écritures,
 * la suppression et la désactivation des comptes.
 */
export const accountController = {
  /**
   * Vérifie si un compte comptable peut être supprimé en toute sécurité.
   * Un compte ne peut pas être supprimé s'il possède des écritures comptables,
   * des sous-comptes rattachés, ou s'il est lié à des immobilisations/relevés.
   *
   * @param {Object} account - Le compte à vérifier ({ id, numero, libelle, ... })
   * @returns {Promise<{ canDelete: boolean, reason: string|null, details: Object }>}
   */
  async checkCanDelete(account) {
    if (!account?.id) {
      return {
        canDelete: false,
        reason: 'Compte invalide ou non identifié.',
        details: {},
      };
    }

    try {
      // 1. Vérifier si le compte est utilisé dans des lignes d'écritures comptables
      const { count: entriesCount, error: entriesError } = await supabase
        .from('lignes_ecritures')
        .select('id', { count: 'exact', head: true })
        .eq('compte_id', account.id);

      if (entriesError) throw entriesError;

      // 2. Vérifier si d'autres comptes ont ce compte comme parent
      const { count: childrenCount, error: childrenError } = await supabase
        .from('comptes_comptables')
        .select('id', { count: 'exact', head: true })
        .eq('compte_parent_id', account.id);

      if (childrenError) throw childrenError;

      // 3. Vérifier si le compte est référencé dans des immobilisations
      let immoCount = 0;
      try {
        const { count, error } = await supabase
          .from('immobilisations')
          .select('id', { count: 'exact', head: true })
          .eq('compte_id', account.id);
        if (!error && count) immoCount = count;
      } catch (_) {
        // Table optionnelle selon modules actifs
      }

      // 4. Vérifier si le compte est référencé dans des relevés bancaires
      let releveCount = 0;
      try {
        const { count, error } = await supabase
          .from('lignes_releve_bancaire')
          .select('id', { count: 'exact', head: true })
          .eq('compte_id', account.id);
        if (!error && count) releveCount = count;
      } catch (_) {
        // Table optionnelle selon modules actifs
      }

      const hasEntries = (entriesCount || 0) > 0;
      const hasChildren = (childrenCount || 0) > 0;
      const hasImmo = immoCount > 0;
      const hasReleves = releveCount > 0;

      const canDelete = !hasEntries && !hasChildren && !hasImmo && !hasReleves;

      let reason = null;
      if (hasEntries) {
        reason = `Ce compte est rattaché à ${entriesCount} écriture(s) comptable(s). Pour garantir l'intégrité historique et fiscale, il ne peut pas être supprimé. Vous pouvez en revanche le désactiver.`;
      } else if (hasChildren) {
        reason = `Ce compte possède ${childrenCount} sous-compte(s) qui lui sont rattachés. Vous devez d'abord supprimer ou réassigner ces sous-comptes.`;
      } else if (hasImmo) {
        reason = `Ce compte est utilisé par ${immoCount} fiche(s) d'immobilisation active(s).`;
      } else if (hasReleves) {
        reason = `Ce compte est lié à ${releveCount} ligne(s) de rapprochement / relevé bancaire.`;
      }

      return {
        canDelete,
        reason,
        details: {
          entriesCount: entriesCount || 0,
          childrenCount: childrenCount || 0,
          immoCount,
          releveCount,
        },
      };
    } catch (err) {
      console.error('Erreur lors du contrôle avant suppression de compte:', err);
      return {
        canDelete: false,
        reason: `Erreur lors de la vérification des dépendances du compte : ${err.message}`,
        details: {},
      };
    }
  },

  /**
   * Contrôleur de suppression d'un compte comptable.
   * Effectue un contrôle préalable des dépendances avant la requête DELETE.
   *
   * @param {Object} account - Le compte à supprimer
   * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
   */
  async deleteAccount(account) {
    if (!account?.id) {
      return { success: false, error: 'Identifiant du compte manquant.' };
    }

    // Contrôle d'intégrité préalable
    const check = await this.checkCanDelete(account);
    if (!check.canDelete) {
      return {
        success: false,
        canDeactivate: check.details.entriesCount > 0,
        error: check.reason,
      };
    }

    // Exécution de la suppression
    const { error } = await supabase
      .from('comptes_comptables')
      .delete()
      .eq('id', account.id);

    if (error) {
      // Diagnostic des erreurs RLS et clés étrangères
      if (error.code === '42501' || error.message?.includes('permission')) {
        return {
          success: false,
          error: "Action refusée : vous ne disposez pas des privilèges nécessaires pour supprimer ce compte.",
        };
      }
      if (error.code === '23503') {
        return {
          success: false,
          canDeactivate: true,
          error: "Ce compte est référencé dans des enregistrements liés et ne peut pas être supprimé. Désactivez-le à la place.",
        };
      }
      return {
        success: false,
        error: `Échec de la suppression : ${error.message}`,
      };
    }

    return {
      success: true,
      message: `Le compte ${account.numero} — ${account.libelle} a été supprimé avec succès.`,
    };
  },

  /**
   * Désactive un compte comptable (actif = false) lorsqu'il ne peut pas être supprimé
   * en raison d'écritures existantes.
   *
   * @param {Object} account - Le compte à désactiver
   * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
   */
  async deactivateAccount(account) {
    if (!account?.id) {
      return { success: false, error: 'Identifiant du compte manquant.' };
    }

    const { error } = await supabase
      .from('comptes_comptables')
      .update({ actif: false })
      .eq('id', account.id);

    if (error) {
      return {
        success: false,
        error: `Impossible de désactiver le compte : ${error.message}`,
      };
    }

    return {
      success: true,
      message: `Le compte ${account.numero} — ${account.libelle} a été désactivé. Il n'apparaîtra plus pour les nouvelles écritures.`,
    };
  },
};
