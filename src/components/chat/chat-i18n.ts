export type ChatLocale = "en" | "fr" | "ar";

export const CHAT_UI = {
  buttonLabel: {
    en: "Chat with our AI",
    fr: "Discuter avec notre IA",
    ar: "تحدث مع الذكاء الاصطناعي",
  },
  header: {
    en: "Ibda3 Assistant",
    fr: "Assistant Ibda3",
    ar: "مساعد إبداع",
  },
  subheader: {
    en: "AI · Reply in a few seconds",
    fr: "IA · Réponse en quelques secondes",
    ar: "ذكاء اصطناعي · إجابة خلال ثوانٍ",
  },
  demoBanner: {
    en: "Demo chatbot — powered by Claude. Your conversation is logged for training.",
    fr: "Chatbot démo — propulsé par Claude. Votre conversation est enregistrée pour amélioration.",
    ar: "روبوت محادثة تجريبي — يعمل بـ Claude. يتم تسجيل محادثتك لأغراض التحسين.",
  },
  greeting: {
    en: "Hi 👋 I can answer questions about our services, pricing, and portfolio. What would you like to know?",
    fr: "Bonjour 👋 Je peux répondre à vos questions sur nos services, tarifs, et portfolio. Que voulez-vous savoir ?",
    ar: "مرحباً 👋 يمكنني الإجابة عن أسئلتك حول خدماتنا وأسعارنا وأعمالنا السابقة. ماذا تريد أن تعرف؟",
  },
  placeholder: {
    en: "Type your question…",
    fr: "Tapez votre question…",
    ar: "اكتب سؤالك…",
  },
  send: {
    en: "Send",
    fr: "Envoyer",
    ar: "إرسال",
  },
  thinking: {
    en: "Thinking…",
    fr: "Réflexion…",
    ar: "جارٍ التفكير…",
  },
  errorGeneric: {
    en: "Something went wrong. Please try again.",
    fr: "Une erreur s'est produite. Merci de réessayer.",
    ar: "حدث خطأ. حاول مرة أخرى.",
  },
  errorRateLimit: {
    en: "You've reached the message limit. Please try again in an hour or contact us on WhatsApp.",
    fr: "Vous avez atteint la limite de messages. Réessayez dans une heure ou contactez-nous sur WhatsApp.",
    ar: "لقد وصلت إلى الحد الأقصى من الرسائل. حاول مرة أخرى بعد ساعة أو تواصل معنا على واتساب.",
  },
  leadCTA: {
    en: "Want the team to follow up? Leave your contact.",
    fr: "Vous voulez que l'équipe vous rappelle ? Laissez vos coordonnées.",
    ar: "تريد أن يتواصل معك الفريق؟ اترك بياناتك.",
  },
  leadName: {
    en: "Full name",
    fr: "Nom complet",
    ar: "الاسم الكامل",
  },
  leadEmail: {
    en: "Email",
    fr: "Email",
    ar: "البريد الإلكتروني",
  },
  leadPhone: {
    en: "Phone (optional)",
    fr: "Téléphone (optionnel)",
    ar: "الهاتف (اختياري)",
  },
  leadMessage: {
    en: "Anything specific to share?",
    fr: "Quelque chose de précis à partager ?",
    ar: "أي شيء محدد تريد مشاركته؟",
  },
  leadSubmit: {
    en: "Send to the team",
    fr: "Envoyer à l'équipe",
    ar: "إرسال إلى الفريق",
  },
  leadSuccess: {
    en: "Thanks — we'll be in touch within a few hours.",
    fr: "Merci — on vous répond dans quelques heures.",
    ar: "شكراً — سنتواصل معك خلال ساعات قليلة.",
  },
  leadOrWhatsapp: {
    en: "or message us on WhatsApp",
    fr: "ou contactez-nous sur WhatsApp",
    ar: "أو راسلنا على واتساب",
  },
  close: {
    en: "Close",
    fr: "Fermer",
    ar: "إغلاق",
  },
} as const;

export function t(key: keyof typeof CHAT_UI, locale: ChatLocale): string {
  return CHAT_UI[key][locale] ?? CHAT_UI[key].en;
}
