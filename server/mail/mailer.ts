import { logger } from "../logger";
import { smtpFrom, smtpHost, smtpPass, smtpPort, smtpUser } from "../env";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface Mailer {
  sendMail(message: MailMessage): Promise<void>;
}

let override: Mailer | null = null;

export function setMailerForTests(mailer: Mailer | null) {
  override = mailer;
}

export function isMailConfigured(): boolean {
  return override != null || Boolean(smtpHost());
}

/** Brevo (and similar relays) queue then drop mail if From is the SMTP login. */
export function smtpFromIsLogin(): boolean {
  const from = smtpFrom().toLowerCase();
  const user = smtpUser().trim().toLowerCase();
  if (from.includes("@smtp-brevo.com")) {
    return true;
  }
  return Boolean(user && from.includes(user));
}

export function getMailer(): Mailer {
  if (override) {
    return override;
  }
  if (!smtpHost()) {
    throw new Error("EMAIL_NOT_CONFIGURED");
  }
  return smtpMailer;
}

const smtpMailer: Mailer = {
  async sendMail(message) {
    if (smtpFromIsLogin()) {
      throw new Error("SMTP_FROM_INVALID");
    }
    const nodemailer = await import("nodemailer");
    const port = smtpPort();
    const transporter = nodemailer.createTransport({
      host: smtpHost(),
      port,
      secure: port === 465,
      requireTLS: port === 587 || port === 2525,
      auth: smtpUser() ? { user: smtpUser(), pass: smtpPass() } : undefined,
    });
    const info = await transporter.sendMail({
      from: smtpFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    const rejected = info.rejected ?? [];
    logger.info("Mail queued", {
      messageId: info.messageId,
      accepted: (info.accepted ?? []).length,
      rejected: rejected.length,
      response: info.response,
    });
    if (rejected.length > 0) {
      throw new Error("EMAIL_REJECTED");
    }
  },
};
