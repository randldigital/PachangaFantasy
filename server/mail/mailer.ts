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
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost(),
      port: smtpPort(),
      secure: smtpPort() === 465,
      auth: smtpUser() ? { user: smtpUser(), pass: smtpPass() } : undefined,
    });
    await transporter.sendMail({
      from: smtpFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  },
};
