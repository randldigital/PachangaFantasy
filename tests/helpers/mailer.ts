import { setMailerForTests, type MailMessage } from "../../server/mail/mailer";

class CapturingMailer {
  sent: MailMessage[] = [];

  async sendMail(message: MailMessage) {
    this.sent.push(message);
  }

  reset() {
    this.sent = [];
  }

  lastTokenFor(email: string): string | undefined {
    const message = [...this.sent].reverse().find((row) => row.to === email);
    const match = message?.text.match(/token=([A-Za-z0-9]+)/);
    return match?.[1];
  }
}

export const testMailer = new CapturingMailer();

export function installTestMailer() {
  setMailerForTests(testMailer);
}

export function uninstallTestMailer() {
  setMailerForTests(null);
}
