# CIPRESA Accounting Dashboard

Frontend React/Vite pour l'application de gestion comptable CIPRESA.

## Lancer

```bash
npm install
npm run dev
```

## Écrans

- `/connexion` — écran Connexion fidèle au screenshot fourni
- `/inscription` — écran Créer un compte fidèle au screenshot fourni, avec panneau marketing et aperçu de la navigation
- `/mot-de-passe-oublie`
- `/dashboard`
- `/plan-comptable`
- `/journal`
- `/grand-livre`
- `/balance`
- `/bilan`
- `/compte-resultat`
- `/tresorerie`
- `/rapprochement`
- `/tva-taxes`
- `/immobilisations`
- `/clotures`
- `/parametres`
- `/profil`
- `/nouveau-compte`
- `/nouvelle-immobilisation`

## Architecture

Les layouts, composants UI, formulaires, pages et styles sont séparés. Les couleurs et dimensions communes sont centralisées dans `src/styles/tokens.css`.

Les écrans d'authentification ont été ajustés à partir des deux screenshots transmis :
- typographie Inter / fallback système
- fond bleu nuit `#0F172A`
- primaire turquoise `#0D9488`
- champs à bordure claire et rayon 8px
- grille deux colonnes pour l'inscription
- métriques et pied de page du panneau marketing
- aperçu de sidebar dans l'écran d'inscription
- responsive pour petits écrans

Les données sont actuellement mockées et les formulaires simulent les navigations. Le frontend est prêt à être relié à une API/backend.
# compaCipresa
