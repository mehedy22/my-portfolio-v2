/**
 * Outbound notifications. One seam, because the delivery mechanism is genuinely undecided
 * (OPEN_QUESTIONS #13, D-028): the flows that need one are built against this interface and a
 * provider drops in behind it later without touching a caller.
 */
export type Notifier = {
  newContactMessage(fromName: string, fromEmail: string, subject: string | null): Promise<void>;
  passwordReset(toEmail: string, token: string): Promise<void>;
};

/**
 * The placeholder: it writes to the log instead of sending anything.
 *
 * <p>Deliberately not silent — an operator reading the log can see that a notification was due
 * and was not delivered, which is the honest state of affairs rather than a flow that appears to
 * work. The reset token is never logged: a log file is not a mailbox, and writing it there would
 * turn an undelivered credential into a stored one.
 */
export const loggingNotifier: Notifier = {
  async newContactMessage(fromName, fromEmail, subject) {
    console.info(
      `NOTIFICATION (not delivered — no email provider configured): new contact message from ` +
        `${fromName} <${fromEmail}> subject='${subject ?? ""}'`,
    );
  },
  async passwordReset(toEmail) {
    console.warn(
      `NOTIFICATION (not delivered — no email provider configured): password reset requested for ` +
        `${toEmail}. The token was generated but cannot be sent; configure a provider ` +
        "(OPEN_QUESTIONS #13) before relying on self-service reset.",
    );
  },
};

export const notifier: Notifier = loggingNotifier;
