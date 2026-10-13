import { useMemo, useState } from 'react';
import { BookOpen, CircleHelp, Search } from 'lucide-react';
import Card from '../components/ui/Card';

const QUESTIONS = [
  {
    category: 'Bien commencer',
    question: 'À quoi sert la plateforme CIPRESA ?',
    answer: 'CIPRESA centralise les opérations comptables de l’entreprise : plan de comptes, journaux, écritures, consultation du grand livre et de la balance, états financiers, trésorerie, immobilisations et suivi des clôtures. Les données sont enregistrées dans Supabase et les écrans disponibles dépendent des droits attribués à votre compte.',
  },
  {
    category: 'Bien commencer',
    question: 'Que faire lors de ma première connexion ?',
    answer: 'L’administrateur prépare les paramètres de l’entreprise, les exercices, les journaux et les comptes comptables, puis attribue un rôle aux utilisateurs. Avant de saisir ou consulter des opérations, vérifiez l’exercice affiché dans la barre supérieure. Si votre compte vient d’être créé, confirmez votre adresse e-mail avec le code reçu puis connectez-vous.',
  },
  {
    category: 'Bien commencer',
    question: 'Comment sélectionner le bon exercice ?',
    answer: 'Utilisez le sélecteur « Exercice comptable » en haut de l’écran. Il est partagé par les pages de l’application qui affichent des données par exercice et votre sélection est mémorisée dans ce navigateur. À la première ouverture, l’application choisit un exercice ouvert, ou à défaut le plus récent. Vérifiez toujours l’exercice avant de créer une écriture ou un compte.',
  },
  {
    category: 'Bien commencer',
    question: 'Peut-on avoir plusieurs exercices pour une même année ?',
    answer: 'Oui. Chaque exercice possède un code unique, une année et une plage de dates comprise dans cette année. Par exemple, plusieurs périodes distinctes peuvent être créées pour 2026 avec des codes différents. La sélection se fait par exercice, pas seulement par année.',
  },
  {
    category: 'Bien commencer',
    question: 'Comment retrouver un compte ou une écriture ?',
    answer: 'La recherche dans la barre supérieure commence à partir de deux caractères et porte sur les comptes et écritures de l’exercice sélectionné. La page Journal comptable propose également des filtres par journal, période et texte.',
  },
  {
    category: 'Paramètres',
    question: 'À quoi servent les Paramètres ?',
    answer: 'Les Paramètres regroupent les informations de l’entreprise, les exercices, les journaux, les utilisateurs, les intégrations et les options de sécurité. Les onglets accessibles et les opérations possibles dépendent de votre rôle et des règles d’accès de la base.',
  },
  {
    category: 'Paramètres',
    question: 'Comment créer ou modifier un exercice ?',
    answer: 'Dans Paramètres → Exercices, saisissez un code, une année, une date de début et une date de fin. Les deux dates doivent appartenir à l’année indiquée, et la date de début doit précéder la date de fin. Vous pouvez modifier une période si elle ne rend pas les dates des écritures liées incohérentes. La suppression peut être refusée si des données y sont rattachées.',
  },
  {
    category: 'Paramètres',
    question: 'À quoi servent les journaux comptables ?',
    answer: 'Les journaux classent les écritures par nature. Les types prévus dans l’application sont Achats, Ventes, Banque, Caisse et Opérations diverses (OD). Ils se configurent dans Paramètres → Journaux. Choisissez le journal correspondant à la pièce et à l’opération enregistrée.',
  },
  {
    category: 'Comptabilité',
    question: 'Comment créer un compte comptable ?',
    answer: 'Ouvrez Plan comptable puis Nouveau compte. Renseignez le numéro, le libellé, la classe, la nature et l’exercice auquel le compte appartient. Le compte est ensuite disponible pour les écritures de cet exercice. Les comptes et soldes d’ouverture sont à vérifier avant la saisie des opérations.',
  },
  {
    category: 'Comptabilité',
    question: 'Comment saisir une écriture ?',
    answer: 'Ouvrez Nouvelle écriture, vérifiez l’exercice, choisissez le journal, la date et le libellé, puis ajoutez les lignes avec leur compte et leur montant au débit ou au crédit. Une écriture doit comporter des lignes équilibrées : total débit égal au total crédit. Vous pouvez joindre des justificatifs, puis enregistrer en brouillon ou demander la validation.',
  },
  {
    category: 'Comptabilité',
    question: 'Quelle différence entre brouillon et écriture validée ?',
    answer: 'Un brouillon reste modifiable et peut être supprimé depuis le journal. La validation passe par la fonction de base de données valider_ecriture, qui contrôle l’écriture et attribue son numéro définitif. Une écriture validée est verrouillée dans le formulaire : pour corriger une opération déjà validée, suivez la procédure comptable de correction ou d’extourne de votre organisation.',
  },
  {
    category: 'Comptabilité',
    question: 'Pourquoi mon écriture ne peut-elle pas être validée ?',
    answer: 'Vérifiez que l’exercice et le journal sont sélectionnés, que la date est comprise dans la période de l’exercice, que chaque compte existe dans cet exercice et que les totaux débit et crédit sont égaux. Une erreur renvoyée par Supabase peut aussi indiquer un droit manquant ou une règle de validation côté base.',
  },
  {
    category: 'Comptabilité',
    question: 'À quoi sert le Journal comptable ?',
    answer: 'Il présente les écritures de l’exercice choisi, séparées entre brouillons et écritures validées. Vous pouvez filtrer par journal et dates, rechercher par texte, consulter les montants et les justificatifs, et poursuivre ou supprimer un brouillon. Les opérations validées sont destinées à la consultation.',
  },
  {
    category: 'Comptabilité',
    question: 'À quoi sert le Grand livre ?',
    answer: 'Le Grand livre détaille les mouvements compte par compte, avec les soldes d’ouverture, les mouvements de la période et le solde de fin. Il sert à examiner l’origine d’un solde et à retrouver les opérations qui l’ont composé. C’est un état de consultation : la correction se fait sur l’écriture source, si elle est encore modifiable.',
  },
  {
    category: 'États financiers',
    question: 'Quelle différence entre la Balance, le Bilan et le Compte de résultat ?',
    answer: 'La Balance récapitule les soldes et mouvements des comptes. Le Bilan regroupe les postes d’actif et de passif à la date de clôture. Le Compte de résultat synthétise les charges et produits de l’exercice afin de calculer les résultats d’exploitation et net. Ces états se consultent pour l’exercice sélectionné et dépendent de la qualité des écritures validées et du plan comptable.',
  },
  {
    category: 'États financiers',
    question: 'Comment utiliser le suivi de trésorerie ?',
    answer: 'La page Trésorerie présente les comptes de nature Trésorerie de l’exercice, leurs soldes calculés à partir des soldes d’ouverture et des écritures validées, ainsi que les flux mensuels. Contrôlez que les comptes de banque et de caisse sont correctement classés et rattachés à l’exercice.',
  },
  {
    category: 'États financiers',
    question: 'Que contient le Livre d’inventaire ?',
    answer: 'Le Livre d’inventaire présente les soldes des comptes à une date d’arrêté, regroupés par grandes classes (immobilisations, stocks, tiers, trésorerie et autres postes). Il aide à examiner la situation comptable de fin de période. Il ne remplace pas le comptage physique ni les justificatifs d’inventaire.',
  },
  {
    category: 'États financiers',
    question: 'Comment enregistrer une immobilisation ?',
    answer: 'Ouvrez Immobilisations puis Nouvelle immobilisation. Sélectionnez l’exercice, le compte d’immobilisation, la date d’acquisition, la valeur, la durée et les autres informations demandées. La date d’acquisition doit appartenir à la période de l’exercice choisi. Le registre affiche une estimation d’amortissement à titre indicatif : il ne génère pas encore l’écriture comptable de dotation.',
  },
  {
    category: 'Clôture',
    question: 'Comment fonctionne une clôture mensuelle ?',
    answer: 'Dans Clôtures, créez une clôture pour un exercice et une période mensuelle disponible. L’application génère une checklist de 22 contrôles. Les contrôles sont renseignés dans le détail de la clôture. Le passage en pré-clôture demande que tous les contrôles soient traités et que la balance, le rapprochement et la fiscalité soient marqués comme vérifiés. La clôture définitive est ensuite enregistrée dans le suivi.',
  },
  {
    category: 'Accès et rôles',
    question: 'Que peut faire chaque rôle ?',
    answer: 'Les privilèges affichés dans Configuration déterminent les opérations attribuées à chaque rôle. D’après la configuration fournie : ADMIN possède l’ensemble des privilèges; COMPTABLE dispose des droits de saisie et validation comptables ainsi que des fonctions de fiscalité, trésorerie, immobilisations et clôture; GERANT dispose de droits de consultation et de gestion de plusieurs fonctions comptables et de clôture; CONSULTANT est principalement en lecture; AGENT_COMMERCIAL dispose de droits sur les ventes et clients; MAGASINIER dispose de droits sur le stock. Les écrans et actions réellement disponibles dépendent aussi des modules activés et des règles Supabase.',
  },
  {
    category: 'Accès et rôles',
    question: 'Où vérifier les rôles et privilèges ?',
    answer: 'La page Configuration, réservée à ADMIN, affiche les utilisateurs, leurs rôles et les privilèges associés à chaque rôle. Elle permet d’attribuer ou retirer un rôle à un utilisateur et d’activer ou désactiver son compte. Les privilèges sont affichés pour consultation dans cette page.',
  },
  {
    category: 'Accès et rôles',
    question: 'Pourquoi un bouton ou une donnée peut-il être indisponible ?',
    answer: 'Vérifiez d’abord le rôle qui vous a été attribué, l’exercice sélectionné, le statut de l’écriture ou de la clôture et les champs obligatoires. Un refus Supabase peut provenir des politiques RLS ou d’une permission absente. Contactez l’administrateur en indiquant la page, l’exercice et le message d’erreur.',
  },
  {
    category: 'Compte utilisateur',
    question: 'Comment changer mon mot de passe ou mon profil ?',
    answer: 'Utilisez Mon profil depuis le menu utilisateur pour consulter ou modifier les informations de votre profil. Depuis la page de connexion, Mot de passe oublié permet de demander la réinitialisation par e-mail. Selon la configuration, un code de vérification peut être demandé.',
  },
  {
    category: 'Compte utilisateur',
    question: 'Comment changer le thème ou consulter les notifications ?',
    answer: 'L’icône soleil/lune dans la barre supérieure permet de basculer entre les thèmes clair et sombre. Le panneau de notifications est accessible depuis la même barre. Le menu utilisateur, en bas de la navigation, donne accès au profil et à la déconnexion.',
  },
];

const CATEGORIES = ['Toutes', ...new Set(QUESTIONS.map(({ category }) => category))];

export default function FAQ() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Toutes');

  const visibleQuestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr');
    return QUESTIONS.filter((item) => {
      const matchesCategory = category === 'Toutes' || item.category === category;
      const matchesQuery = !normalizedQuery || `${item.category} ${item.question} ${item.answer}`
        .toLocaleLowerCase('fr')
        .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <div className="page-content faq-page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><CircleHelp size={25} aria-hidden="true" /> Centre d’aide — CIPRESA</h1>
          <p className="page-subtitle">Découvrez les écrans, les règles de saisie et les étapes principales de la plateforme.</p>
        </div>
      </div>

      <Card className="faq-intro">
        <div className="faq-intro-icon"><BookOpen size={22} /></div>
        <div>
          <h2>Bienvenue dans votre espace de gestion comptable</h2>
          <p>Cette aide explique comment préparer un exercice, enregistrer les opérations et consulter les états. Les informations et les actions visibles peuvent varier selon votre rôle et l’exercice choisi dans la barre supérieure.</p>
        </div>
      </Card>

      <div className="faq-tools">
        <label className="faq-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Rechercher dans l’aide</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une question…" />
        </label>
        <div className="faq-categories" aria-label="Filtrer les thèmes">
          {CATEGORIES.map((item) => (
            <button key={item} type="button" className={`faq-category ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} aria-pressed={category === item}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <p className="faq-count" aria-live="polite">{visibleQuestions.length} question{visibleQuestions.length > 1 ? 's' : ''}</p>

      <div className="faq-list">
        {visibleQuestions.map((item) => (
          <details className="faq-item" key={item.question}>
            <summary>
              <span><small>{item.category}</small>{item.question}</span>
              <span className="faq-chevron" aria-hidden="true">+</span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
        {visibleQuestions.length === 0 && <Card><p className="page-subtitle">Aucune question ne correspond à votre recherche. Essayez un autre mot ou choisissez « Toutes ».</p></Card>}
      </div>

      <Card className="faq-contact">
        <h2>Vous avez encore une question ?</h2>
        <p>Notez le nom de la page, le code de l’exercice sélectionné et le message affiché, puis transmettez ces informations à l’administrateur de votre organisation.</p>
      </Card>
    </div>
  );
}
