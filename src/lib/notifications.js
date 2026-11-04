import Swal from 'sweetalert2';

export const dateFrCourt = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffJ = Math.round(diffH / 24);
  if (diffJ < 7) return `il y a ${diffJ} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

export const TYPE_LABEL = {
  TVA: 'TVA', CLOTURE: 'Clôture', RAPPROCHEMENT: 'Rapprochement', ECRITURE: 'Écriture',
  SYSTEME: 'Système', UTILISATEUR: 'Utilisateur',
};

const dialogClasses = {
  popup: 'cipresa-swal-popup',
  title: 'cipresa-swal-title',
  htmlContainer: 'cipresa-swal-text',
  actions: 'cipresa-swal-actions',
  confirmButton: 'cipresa-swal-confirm',
  cancelButton: 'cipresa-swal-cancel',
  input: 'cipresa-swal-input',
  validationMessage: 'cipresa-swal-validation',
};

const toastPopup = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 4200,
  timerProgressBar: true,
  showCloseButton: true,
  customClass: {
    popup: 'cipresa-toast-popup',
    title: 'cipresa-toast-title',
    timerProgressBar: 'cipresa-toast-progress',
  },
  didOpen: (toastElement) => {
    toastElement.addEventListener('mouseenter', Swal.stopTimer);
    toastElement.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const toast = {
  success(title, text) { return toastPopup.fire({ icon: 'success', title, text }); },
  error(title, text) { return toastPopup.fire({ icon: 'error', title, text }); },
  warning(title, text) { return toastPopup.fire({ icon: 'warning', title, text }); },
  info(title, text) { return toastPopup.fire({ icon: 'info', title, text }); },
};

export async function confirmAction({
  title,
  text = '',
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  danger = false,
}) {
  const result = await Swal.fire({
    icon: danger ? 'warning' : 'question',
    title,
    text,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    buttonsStyling: false,
    customClass: {
      ...dialogClasses,
      confirmButton: danger ? 'cipresa-swal-confirm is-danger' : 'cipresa-swal-confirm',
    },
  });
  return result.isConfirmed;
}

export async function editPhysicalInventory({ title, etat = '', emplacement = '', observation = '' }) {
  const result = await Swal.fire({
    title,
    html: '<div class="cipresa-swal-form"><label>État physique<input id="cipresa-inventory-state" class="swal2-input" placeholder="Bon, à réparer, hors service…"></label><label>Emplacement<input id="cipresa-inventory-location" class="swal2-input" placeholder="Ex. Magasin principal"></label><label>Observation<textarea id="cipresa-inventory-note" class="swal2-textarea" placeholder="Ajouter une observation (facultatif)"></textarea></label></div>',
    showCancelButton: true,
    reverseButtons: true,
    focusConfirm: false,
    confirmButtonText: 'Enregistrer',
    cancelButtonText: 'Annuler',
    buttonsStyling: false,
    customClass: dialogClasses,
    didOpen: () => {
      document.getElementById('cipresa-inventory-state').value = etat;
      document.getElementById('cipresa-inventory-location').value = emplacement;
      document.getElementById('cipresa-inventory-note').value = observation;
    },
    preConfirm: () => ({
      etat: document.getElementById('cipresa-inventory-state').value.trim(),
      emplacement: document.getElementById('cipresa-inventory-location').value.trim(),
      observation: document.getElementById('cipresa-inventory-note').value.trim(),
    }),
  });
  return result.isConfirmed ? result.value : null;
}

export function showAlert({ title, text = '', icon = 'info', confirmText = 'Compris' }) {
  return Swal.fire({
    icon, title, text, confirmButtonText: confirmText, buttonsStyling: false,
    customClass: dialogClasses,
  });
}
