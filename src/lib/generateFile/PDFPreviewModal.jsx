// src/lib/generateFile/PDFPreviewModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Printer, Download, X, FileText, Loader2, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';

/**
 * Modal de prévisualisation PDF avec sélection de l'orientation (Paysage / Portrait),
 * impression directe et téléchargement.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Visibilité de la modale
 * @param {Function} props.onClose - Callback de fermeture
 * @param {string} [props.title] - Titre du document affiché dans l'en-tête
 * @param {string} [props.subtitle] - Sous-titre
 * @param {string} [props.filename] - Nom de fichier pour le téléchargement (sans .pdf)
 * @param {'landscape'|'portrait'} [props.defaultOrientation='landscape'] - Orientation initiale
 * @param {Function} props.renderDocument - Fonction (orientation) => ReactPDF.Document
 */
export default function PDFPreviewModal({
  isOpen,
  onClose,
  title = 'Aperçu avant impression',
  subtitle = '',
  filename = 'document',
  defaultOrientation = 'landscape',
  renderDocument,
}) {
  const [orientation, setOrientation] = useState(defaultOrientation);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  // Synchronise l'orientation par défaut à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setOrientation(defaultOrientation);
    }
  }, [isOpen, defaultOrientation]);

  // Génération du PDF lors de l'ouverture ou du changement d'orientation
  useEffect(() => {
    if (!isOpen || typeof renderDocument !== 'function') return;

    let active = true;
    setLoading(true);
    setError(null);

    const generatePdf = async () => {
      try {
        const doc = renderDocument(orientation);
        const blob = await pdf(doc).toBlob();
        if (!active) return;

        const newUrl = URL.createObjectURL(blob);
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return newUrl;
        });
      } catch (err) {
        console.error('Erreur lors de la génération du PDF :', err);
        if (active) setError(err.message || 'Impossible de générer le document PDF.');
      } finally {
        if (active) setLoading(false);
      }
    };

    generatePdf();

    return () => {
      active = false;
    };
  }, [isOpen, orientation, renderDocument]);

  // Nettoyage de l'URL blob à la fermeture
  useEffect(() => {
    if (!isOpen && blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  }, [isOpen]);

  // Raccourci Échap pour fermer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (e) {
        console.warn('Iframe print a échoué, ouverture directe...', e);
      }
    }
    if (blobUrl) {
      const printWin = window.open(blobUrl, '_blank');
      printWin?.focus();
      printWin?.print();
    }
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${filename}_${orientation}.pdf`;
    a.click();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '95vw',
          maxWidth: '1200px',
          height: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* En-tête de la modale */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Titre et détails */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(22, 101, 52, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#166534',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Sélecteur d'Orientation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#e2e8f0',
              padding: '3px',
              borderRadius: '8px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              disabled={loading && orientation === 'landscape'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: orientation === 'landscape' ? 600 : 500,
                backgroundColor: orientation === 'landscape' ? '#166534' : 'transparent',
                color: orientation === 'landscape' ? '#ffffff' : '#334155',
                transition: 'all 0.15s ease',
              }}
              title="Orientation Paysage (Horizontal)"
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '10px',
                  border: `1.5px solid ${orientation === 'landscape' ? '#fff' : '#64748b'}`,
                  borderRadius: '2px',
                }}
              />
              Paysage
            </button>

            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              disabled={loading && orientation === 'portrait'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: orientation === 'portrait' ? 600 : 500,
                backgroundColor: orientation === 'portrait' ? '#166534' : 'transparent',
                color: orientation === 'portrait' ? '#ffffff' : '#334155',
                transition: 'all 0.15s ease',
              }}
              title="Orientation Portrait (Vertical)"
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '14px',
                  border: `1.5px solid ${orientation === 'portrait' ? '#fff' : '#64748b'}`,
                  borderRadius: '2px',
                }}
              />
              Portrait
            </button>
          </div>

          {/* Actions : Imprimer, Télécharger, Fermer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="primary"
              icon={Printer}
              onClick={handlePrint}
              disabled={loading || !blobUrl}
              title="Lancer l'impression"
            >
              Imprimer
            </Button>

            <Button
              variant="outline"
              icon={Download}
              onClick={handleDownload}
              disabled={loading || !blobUrl}
              title="Télécharger le fichier PDF"
            >
              Télécharger PDF
            </Button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                marginLeft: '4px',
              }}
              title="Fermer la prévisualisation (Échap)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corps de la modale / Lecteur PDF */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#334155',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                gap: '12px',
              }}
            >
              <Loader2 className="animate-spin" size={36} color="#34d399" />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
                Génération de l'aperçu PDF ({orientation === 'landscape' ? 'Paysage' : 'Portrait'})...
              </p>
            </div>
          )}

          {error ? (
            <div
              style={{
                padding: '24px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                maxWidth: '480px',
                textAlign: 'center',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '8px' }}>
                Erreur de rendu du PDF
              </p>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>{error}</p>
              <Button
                variant="outline"
                icon={RefreshCw}
                onClick={() => setOrientation((o) => (o === 'landscape' ? 'landscape' : 'portrait'))}
              >
                Réessayer
              </Button>
            </div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title="Prévisualisation du document PDF"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
