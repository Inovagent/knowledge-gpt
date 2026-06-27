const GMAIL_SAVE_BUTTON_CLASS = "kg-email-save-button";
const GMAIL_SAVE_BUTTON_SELECTOR = `.${GMAIL_SAVE_BUTTON_CLASS}`;
const GMAIL_PROCESSED_EMAILS_KEY = "processedEmails";

const GMAIL_ICONS = {
  idle: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10"></path>
      <path d="m8 10 4 4 4-4"></path>
      <path d="M5 19h14"></path>
    </svg>
  `,
  loading: `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="is-spinning">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
    </svg>
  `,
  saved: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6 9 17l-5-5"></path>
    </svg>
  `,
  skipped: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h16"></path>
      <path d="M16 6l4 6-4 6"></path>
    </svg>
  `,
  error: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9v4"></path>
      <path d="M12 17h.01"></path>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    </svg>
  `
};
