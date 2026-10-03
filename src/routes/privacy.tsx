import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, renderSections, CONTACT_EMAIL, type Sections } from "@/components/legal-page";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Privacy Policy — Clario" },
    { name: "description", content: "What data Clario collects, how your documents stay private, and how to delete your data." },
    { property: "og:title", content: "Privacy Policy — Clario" },
    { property: "og:description", content: "How Clario keeps your study documents private and what data we collect." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Privacy,
});

const EN: Sections = [
  { h: "What we collect", li: ["Account: email, display name, avatar and language.", "Study content: documents, notes, annotations, chats, quizzes and videos you create.", "Billing: plan and credit history (card details are handled only by our payment provider).", "Basic technical logs needed for security and fixing bugs."] },
  { h: "How your content is protected", p: "Your files are stored in private storage, only accessible to your account. Other users can never see your documents, notes or chats." },
  { h: "AI processing", p: "When you ask Clario a question or create a video or quiz, the relevant page and text are sent to our AI provider only to produce the answer. Your content is not used to train public AI models and is not sold." },
  { h: "Sharing", p: "We never sell your data. We only share what is needed with service providers (hosting, AI, payments) to run Clario." },
  { h: "Your rights", li: ["Access, correct or export your data.", "Delete your account and all your content at any time.", "Withdraw consent and contact us about any concern (GDPR / PIPEDA / Quebec Law 25)."] },
  { h: "Retention", p: "We keep your data while your account is active. After deletion, it is removed from our systems within 30 days, except where the law requires us to keep billing records." },
  { h: "Contact", p: `For any privacy request: ${CONTACT_EMAIL}.` },
];
const FR: Sections = [
  { h: "Ce que nous collectons", li: ["Compte : e-mail, prénom ou pseudo, avatar et langue.", "Contenu d'étude : documents, notes, annotations, discussions, quiz et vidéos que tu crées.", "Facturation : forfait et historique de crédits (les cartes sont gérées uniquement par notre prestataire de paiement).", "Journaux techniques de base, nécessaires à la sécurité et à la correction des bogues."] },
  { h: "Protection de ton contenu", p: "Tes fichiers sont stockés dans un espace privé, accessible uniquement à ton compte. Les autres utilisateurs ne peuvent jamais voir tes documents, notes ou discussions." },
  { h: "Traitement par l'IA", p: "Quand tu poses une question ou crées une vidéo ou un quiz, la page et le texte concernés sont envoyés à notre fournisseur d'IA uniquement pour produire la réponse. Ton contenu n'entraîne pas de modèles publics et n'est jamais vendu." },
  { h: "Partage", p: "Nous ne vendons jamais tes données. Nous partageons seulement le nécessaire avec nos prestataires (hébergement, IA, paiements) pour faire fonctionner Clario." },
  { h: "Tes droits", li: ["Accéder à tes données, les corriger ou les exporter.", "Supprimer ton compte et tout ton contenu à tout moment.", "Retirer ton consentement et nous contacter pour toute question (RGPD / LPRPDE / Loi 25 du Québec)."] },
  { h: "Conservation", p: "Nous conservons tes données tant que ton compte est actif. Après suppression, elles sont effacées sous 30 jours, sauf les registres de facturation exigés par la loi." },
  { h: "Contact", p: `Pour toute demande liée à la confidentialité : ${CONTACT_EMAIL}.` },
];

function Privacy() {
  const { locale } = useI18n();
  const fr = locale === "fr";
  return <LegalPage title={fr ? "Politique de confidentialité" : "Privacy Policy"} updated={fr ? "Dernière mise à jour : 2 octobre 2026" : "Last updated: October 2, 2026"}>{renderSections(fr ? FR : EN)}</LegalPage>;
}
