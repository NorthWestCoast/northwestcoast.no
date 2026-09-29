// Tynt lag over Umami/GTM. Begge er valgfrie – uten env-variabler gjør
// track() ingenting, og siden fungerer som før.
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
    dataLayer?: Record<string, unknown>[];
  }
}

export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
export const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC ?? 'https://cloud.umami.is/script.js';
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/** Konverteringshendelsene vi faktisk bryr oss om. */
export const EVENTS = {
  orderSubmitted: 'order_submitted',
  orderItemAdded: 'order_item_added',
  calculatorOrder: 'calculator_order_submitted',
  contactSubmitted: 'contact_submitted',
  faqQuestionSubmitted: 'faq_question_submitted',
  newsletterSignup: 'newsletter_signup',
  maintenanceLogged: 'maintenance_logged',
  languageSwitched: 'language_switched',
} as const;

export function track(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.umami?.track(event, data);
    if (window.dataLayer) window.dataLayer.push({ event, ...data });
  } catch {
    // Analytics skal aldri velte en innsending.
  }
}
