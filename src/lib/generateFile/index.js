/**
 * @module generateFile
 *
 * Point d'entrée unique pour toutes les fonctions de génération de fichiers.
 *
 * Utilisation :
 *   import { exportToExcel, downloadPDF, GenericTablePDF } from '../../lib/generateFile';
 */

export { exportToExcel }          from './exportExcel.js';
export { downloadPDF, GenericTablePDF } from './exportPDF.jsx';
