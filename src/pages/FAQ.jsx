import { useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, BookOpen, Building2, CalendarDays, CircleHelp,
  ClipboardList, FileText, Lock, Search, ShieldCheck, Sparkles,
  Users, UserRound,
} from 'lucide-react';
import Card from '../components/ui/Card';

const QUESTIONS = [
  {
    category: 'Espace de travail',
    question: 'Comment fonctionne l’accès aux entreprises ?',
    answer: 'Chaque entreprise dispose de ses propres utilisateurs, rôles, exercices, journaux, comptes, écritures et états. Vous ne voyez que les entreprises auxquelles un administrateur vous a associé. Si vous êtes membre de plusieurs entreprises, choisissez l’entreprise active dans la barre supérieure : les pages et les opérations se rapportent alors à cette entreprise.',
  },
  {
    category: 'Espace de travail',
    question: 'À quoi sert le sélecteur d’exercice en haut de l’écran ?',
    answer: 'L’exercice sélectionné dans la barre supérieure est le filtre commun des pages comptables. Le journal, le plan comptable, le grand livre, la balance, le bilan, la trésorerie, les immobilisations et les clôtures chargent les données de cet exercice. Changez d’exercice avant de consulter un état ou de créer une opération. La sélection est mémorisée dans le navigateur.',
  },
  {
    category: 'Espace de travail',
    question: 'Comment sélectionner une autre entreprise ou un autre exercice ?',
    answer: 'Utilisez les deux sélecteurs de la barre supérieure. Commencez par l’entreprise, puis choisissez un exercice de cette entreprise. Si un exercice n’apparaît pas, vérifiez qu’il existe et que votre compte a accès à l’entreprise concernée.',
  },
  {
    category: 'Espace de travail',
    question: 'Peut-on créer plusieurs exercices dans la même année ?',
    answer: 'Oui. Chaque exercice a son code, son année, ses dates de début et de fin, et son statut. Plusieurs exercices peuvent avoir la même année, avec des codes distincts. Les dates doivent être comprises dans l’année déclarée et la date de début doit précéder la date de fin.',
  },
  {
    category: 'Plan comptable',
    question: 'Comment lire le Plan comptable ?',
    answer: 'Les comptes sont regroupés par classe. Une classe affiche ses totaux débit, crédit et différence pour l’exercice sélectionné. Dépliez une classe pour parcourir ses comptes, puis un compte pour voir ses sous-comptes. Les soldes proviennent des soldes d’ouverture et des écritures validées de l’entreprise et de l’exercice actifs. Une différence positive correspond à un solde net débiteur; une différence négative à un solde net créditeur.',
  },
  {
    category: 'Plan comptable',
    question: 'Quelle est la relation entre un compte et ses sous-comptes ?',
    answer: 'La hiérarchie suit la structure du plan OHADA : un compte peut avoir des subdivisions rattachées par leur numéro et leur parent. La page affiche cette relation de façon récursive. Les comptes du référentiel OHADA servent de structure commune; les comptes opérationnels et leurs soldes sont rattachés à l’entreprise et à l’exercice. Un sous-compte ne doit pas être créé sans respecter le préfixe et le parent du compte auquel il appartient.',
  },
  {
    category: 'Plan comptable',
    question: 'Comment créer ou modifier un compte ?',
    answer: 'Pour créer un compte, ouvrez Plan comptable puis Nouveau compte, choisissez l’exercice et renseignez son compte de référence, son parent éventuel, son numéro et son libellé. Les comptes déjà utilisés par des écritures ne peuvent pas toujours être supprimés ou modifiés librement. Les champs sensibles, comme le numéro, la classe, la nature et les soldes d’ouverture, sont réservés aux rôles qui ont le privilège comptable élevé. Les actions indisponibles sont masquées selon votre rôle.',
  },
  {
    category: 'Plan comptable',
    question: 'Qui peut exporter le Plan comptable ?',
    answer: 'Dans la configuration actuelle, les rôles ADMIN et COMPTABLE peuvent exporter le Plan comptable en PDF ou Excel. Les exports reprennent les totaux et les détails visibles pour l’entreprise et l’exercice sélectionnés.',
  },
  {
    category: 'Saisie comptable',
    question: 'Comment saisir une écriture ?',
    answer: 'Ouvrez Nouvelle écriture. Vérifiez l’exercice, choisissez le journal, la date et le libellé, puis ajoutez au moins deux lignes. Pour chaque ligne, sélectionnez un compte et saisissez un montant soit au débit, soit au crédit. Le total débit doit être égal au total crédit. Ajoutez la référence de pièce et les justificatifs utiles, puis enregistrez le brouillon.',
  },
  {
    category: 'Saisie comptable',
    question: 'Pourquoi ne puis-je pas choisir un journal ou enregistrer une écriture ?',
    answer: 'Vérifiez que l’exercice est ouvert, qu’il couvre la date de l’opération et qu’un journal est disponible pour l’entreprise active. Les commandes de création et de validation ne sont visibles que si votre rôle les autorise. Supabase contrôle aussi l’entreprise, l’exercice et les permissions au moment de l’enregistrement.',
  },
  {
    category: 'Saisie comptable',
    question: 'Quelle différence entre brouillon et écriture validée ?',
    answer: 'Le brouillon peut être repris par une personne qui dispose du droit de saisie. La validation vérifie notamment que l’exercice est ouvert, que la date est dans sa période, que les lignes sont valides et que les totaux débit et crédit sont égaux. L’écriture validée reçoit son numéro définitif et devient verrouillée. Pour corriger une écriture validée, appliquez la procédure de correction comptable de votre organisation, généralement une écriture de contrepassation ou d’extourne.',
  },
  {
    category: 'Saisie comptable',
    question: 'Qui peut valider une écriture ?',
    answer: 'La validation dépend du privilège COMPTA_VALIDATE attribué dans l’entreprise active. La règle de séparation des tâches empêche son créateur de valider sa propre écriture. Le rôle GERANT ou COMPTABLE peut disposer de ce privilège selon les attributions effectives.',
  },
  {
    category: 'Saisie comptable',
    question: 'À quoi servent le Journal et le Grand livre ?',
    answer: 'Le Journal présente les écritures chronologiquement et permet de retrouver les brouillons et opérations validées. Le Grand livre regroupe les mouvements par compte, avec les soldes et le détail des écritures qui les composent. Ce sont des états de consultation : une écriture validée se corrige depuis la procédure comptable prévue, pas en modifiant directement l’état.',
  },
  {
    category: 'États et exports',
    question: 'Quelle différence entre la Balance, le Bilan et le Compte de résultat ?',
    answer: 'La Balance récapitule les mouvements et soldes des comptes. Le Bilan présente la situation patrimoniale à une date : actifs et passifs. Le Compte de résultat rassemble les charges et les produits de l’exercice pour faire apparaître le résultat. Ces états dépendent des comptes correctement classés et des écritures validées.',
  },
  {
    category: 'États et exports',
    question: 'Qui peut exporter les états comptables ?',
    answer: 'Les rôles GERANT, COMPTABLE et CONSULTANT disposent de l’export des états comptables en PDF et Excel. Pour le Journal, l’export est attribué au CONSULTANT dans la configuration actuelle. L’export du Plan comptable suit son droit spécifique, accordé à ADMIN et COMPTABLE.',
  },
  {
    category: 'États et exports',
    question: 'Comment interpréter la trésorerie ?',
    answer: 'La page Trésorerie présente les comptes classés en trésorerie et leurs mouvements de l’exercice actif. Contrôlez que les comptes de banque, caisse ou mobile money ont la bonne nature et que les opérations correspondantes sont validées. Un solde inhabituel peut venir d’une mauvaise classification ou d’une écriture à vérifier.',
  },
  {
    category: 'Opérations',
    question: 'Quelle différence entre immobilisations et inventaire physique ?',
    answer: 'Le registre comptable des immobilisations suit les biens, leurs valeurs et une estimation des amortissements. Le module d’inventaire physique permet de mettre à jour l’état, l’emplacement et les observations d’un bien. Le calcul affiché est indicatif : il ne génère pas à lui seul l’écriture comptable de dotation aux amortissements.',
  },
  {
    category: 'Opérations',
    question: 'Comment fonctionne la synchronisation des ventes ?',
    answer: 'La page Synchro Ventes récupère les ventes depuis l’application externe configurée. Le rôle autorisé peut gérer les paramètres de connexion et lancer la synchronisation. Vérifiez l’historique et le statut des ventes importées avant leur comptabilisation. Une vente importée n’est pas nécessairement une écriture comptable validée.',
  },
  {
    category: 'Clôtures',
    question: 'Comment se déroule une clôture mensuelle ?',
    answer: 'Une personne autorisée à préparer la clôture crée une période dans l’exercice actif. La fiche de clôture contient une liste de contrôles et des champs de préparation. Le passage en pré-clôture dépend de l’avancement des contrôles requis. Les vérifications de direction et la clôture définitive sont réservées au rôle qui possède COMPTA_CLOTURE_APPROVE.',
  },
  {
    category: 'Utilisateurs et rôles',
    question: 'Les rôles sont-ils les mêmes dans toutes les entreprises ?',
    answer: 'Non. Un utilisateur peut être associé à plusieurs entreprises et avoir un rôle différent dans chacune. Quand vous changez d’entreprise dans la barre supérieure, les droits sont recalculés selon les rôles associés à cette entreprise. Demandez à l’administrateur de vérifier votre association si une page ou une action manque.',
  },
  {
    category: 'Utilisateurs et rôles',
    question: 'Que permet chaque rôle dans la configuration actuelle ?',
    answer: 'ADMIN : gestion des utilisateurs et des paramètres de l’entreprise, lecture comptable et gestion avancée du plan comptable; export du plan. GERANT : consultation comptable, validation, approbation des clôtures, modification des exercices et des champs sensibles du plan; export des états. COMPTABLE : saisie et validation comptables, préparation des clôtures, comptes, trésorerie, immobilisations, synchronisation et inventaire physique; export du plan et des états. CONSULTANT : consultation comptable et exports autorisés. MAGASINIER : inventaire physique des biens. AGENT_COMMERCIAL : consultation et synchronisation des ventes, avec un tableau de bord commercial limité. Les permissions supplémentaires attribuées à un utilisateur peuvent compléter ces rôles.',
  },
  {
    category: 'Utilisateurs et rôles',
    question: 'Qui peut créer une nouvelle entreprise ?',
    answer: 'Seul un utilisateur ayant le rôle ADMIN dans son entreprise active voit le bouton Nouvelle entreprise dans la barre supérieure. Après sa création, l’administrateur doit gérer les membres et leurs rôles dans chaque entreprise. Les autres utilisateurs ne peuvent pas ouvrir les données d’une entreprise tant qu’ils n’y sont pas associés.',
  },
  {
    category: 'Utilisateurs et rôles',
    question: 'Où l’administrateur gère-t-il les utilisateurs et leurs rôles ?',
    answer: 'L’administrateur ouvre Configuration depuis la gestion de l’entreprise ou les Paramètres. Il peut associer un utilisateur à une ou plusieurs entreprises, attribuer ou retirer ses rôles pour chacune, et gérer l’état de son compte. Les rôles et permissions restent propres à chaque entreprise.',
  },
  {
    category: 'Utilisateurs et rôles',
    question: 'Pourquoi un bouton, un champ ou une page n’apparaît-il pas ?',
    answer: 'L’interface masque les liens, formulaires et actions que votre rôle ne permet pas d’utiliser. Vérifiez l’entreprise active et votre rôle dans cette entreprise. Les pages directement ouvertes sans autorisation redirigent vers un espace accessible. Si vous pensez qu’un droit manque, demandez à l’administrateur de vérifier votre association et vos permissions.',
  },
  {
    category: 'Compte et assistance',
    question: 'Comment modifier mon profil ou mon mot de passe ?',
    answer: 'Ouvrez Mon profil dans le menu utilisateur pour modifier vos informations personnelles. Pour changer un mot de passe oublié, utilisez le lien prévu sur la page de connexion et suivez les instructions reçues par e-mail.',
  },
  {
    category: 'Compte et assistance',
    question: 'Que transmet l’assistant comptable ?',
    answer: 'L’assistant peut recevoir votre question, les derniers échanges de la conversation, le nom de la page, l’entreprise et l’exercice actifs, ainsi que le texte et les chiffres visibles dans la page. Ces éléments sont envoyés au service IA externe configuré pour répondre dans le contexte. Évitez d’inclure des informations confidentielles qui ne sont pas nécessaires à votre demande.',
  },
];

const ROLES = [
  { code: 'ADMIN', title: 'Administrateur', icon: ShieldCheck, tone: 'admin', text: 'Gère les utilisateurs et les paramètres de l’entreprise. Peut lire la comptabilité et gérer les comptes sensibles du plan comptable.' },
  { code: 'GERANT', title: 'Gérant', icon: BarChart3, tone: 'manager', text: 'Consulte, valide des écritures, approuve les clôtures et gère certains paramètres comptables et exercices.' },
  { code: 'COMPTABLE', title: 'Comptable', icon: FileText, tone: 'accountant', text: 'Saisit et valide les opérations, prépare les clôtures et gère les fonctions comptables attribuées.' },
  { code: 'CONSULTANT', title: 'Consultant', icon: BookOpen, tone: 'reader', text: 'Consulte les données comptables et exporte les états qui lui sont autorisés.' },
  { code: 'MAGASINIER', title: 'Magasinier', icon: ClipboardList, tone: 'stock', text: 'Met à jour les informations d’inventaire physique des biens.' },
  { code: 'AGENT_COMMERCIAL', title: 'Agent commercial', icon: Users, tone: 'sales', text: 'Consulte l’espace commercial et synchronise les ventes selon les droits attribués.' },
];

const CATEGORIES = ['Toutes', ...new Set(QUESTIONS.map(({ category }) => category))];

const START_STEPS = [
  { icon: Building2, title: 'Choisir l’entreprise', text: 'La barre supérieure détermine l’espace de travail et les droits actifs.' },
  { icon: CalendarDays, title: 'Choisir l’exercice', text: 'Les pages comptables chargent les informations de cet exercice.' },
  { icon: BookOpen, title: 'Suivre les droits visibles', text: 'Les menus, formulaires et actions disponibles suivent votre rôle.' },
];

export default function FAQ() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Toutes');

  const visibleQuestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr');
    return QUESTIONS.filter((item) => {
      const matchesCategory = category === 'Toutes' || item.category === category;
      const matchesQuery = !normalizedQuery || `${item.category} ${item.question} ${item.answer}`
        .toLocaleLowerCase('fr').includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <div className="page-content faq-page">
      <header className="faq-hero">
        <div className="faq-hero-copy">
          <span className="faq-eyebrow"><Sparkles size={14} /> GUIDE D’UTILISATION</span>
          <h1>Comprendre votre espace CIPRESA</h1>
          <p>Un guide pratique pour naviguer entre entreprises, exercices, opérations comptables et rapports.</p>
        </div>
        <div className="faq-hero-mark" aria-hidden="true"><CircleHelp size={54} strokeWidth={1.35} /></div>
        <div className="faq-hero-meta"><span><Building2 size={14} /> Multi-entreprise</span><span><Lock size={14} /> Accès par rôle</span><span><CalendarDays size={14} /> Filtre par exercice</span></div>
      </header>

      <section className="faq-start" aria-labelledby="faq-start-title">
        <div className="faq-section-heading"><div><span className="faq-section-kicker">DÉMARRAGE RAPIDE</span><h2 id="faq-start-title">Avant de commencer</h2></div><p>Trois repères pour que les pages affichent le bon espace et la bonne période.</p></div>
        <div className="faq-steps">
          {START_STEPS.map(({ icon: Icon, title, text }, index) => (
            <Card className="faq-step" key={title}>
              <span className="faq-step-number">0{index + 1}</span><span className="faq-step-icon"><Icon size={18} /></span>
              <h3>{title}</h3><p>{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="faq-roles" aria-labelledby="faq-roles-title">
        <div className="faq-section-heading"><div><span className="faq-section-kicker">HABILITATIONS</span><h2 id="faq-roles-title">Les rôles en bref</h2></div><p>Les rôles s’appliquent dans une entreprise donnée. Un même utilisateur peut avoir des rôles différents ailleurs.</p></div>
        <div className="faq-roles-grid">
          {ROLES.map(({ code, title, icon: Icon, tone, text }) => (
            <article className={`faq-role-card tone-${tone}`} key={code}>
              <span className="faq-role-icon"><Icon size={18} /></span><div><span className="faq-role-code">{code}</span><h3>{title}</h3></div><p>{text}</p>
            </article>
          ))}
        </div>
        <p className="faq-role-note"><ShieldCheck size={15} /> Les privilèges précis contrôlent chaque action. ADMIN ne signifie pas que toutes les permissions comptables sont accordées automatiquement.</p>
      </section>

      <section className="faq-answers" aria-labelledby="faq-answers-title">
        <div className="faq-section-heading"><div><span className="faq-section-kicker">CENTRE D’AIDE</span><h2 id="faq-answers-title">Questions fréquentes</h2></div><p>Recherchez une page, une action ou un terme comptable.</p></div>
        <div className="faq-tools">
          <label className="faq-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Rechercher dans l’aide</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. exercice, validation, export…" /></label>
          <div className="faq-categories" aria-label="Filtrer les thèmes">
            {CATEGORIES.map((item) => <button key={item} type="button" className={`faq-category ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
          </div>
        </div>
        <p className="faq-count" aria-live="polite">{visibleQuestions.length} réponse{visibleQuestions.length === 1 ? '' : 's'}</p>
        <div className="faq-list">
          {visibleQuestions.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary><span><small>{item.category}</small>{item.question}</span><span className="faq-chevron" aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
          {visibleQuestions.length === 0 && <Card className="faq-empty"><Search size={22} /><h3>Aucun résultat</h3><p>Essayez un autre terme ou réinitialisez le filtre de thème.</p><button type="button" onClick={() => { setQuery(''); setCategory('Toutes'); }}>Effacer les filtres</button></Card>}
        </div>
      </section>

      <Card className="faq-contact">
        <span className="faq-contact-icon"><UserRound size={19} /></span>
        <div><h2>Besoin d’une vérification d’accès ?</h2><p>Transmettez à l’administrateur le nom de l’entreprise active, votre rôle, la page concernée et le message affiché.</p></div>
        <ArrowRight className="faq-contact-arrow" size={19} aria-hidden="true" />
      </Card>
    </div>
  );
}
