import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Splits "Grind <reminders@example.com>" into a name and an address. */
function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2] } : { email: from.trim() };
}

/**
 * Sends email through Brevo when BREVO_API_KEY is set, and through SMTP otherwise.
 * The SMTP defaults point at Mailpit from docker-compose, for local development.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly brevoKey?: string;
  private readonly smtp?: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM') ?? 'Grind <reminders@grind.local>';
    this.brevoKey = config.get<string>('BREVO_API_KEY') || undefined;
    if (this.brevoKey) return;

    const port = Number(config.get('SMTP_PORT') ?? 1025);
    const user = config.get<string>('SMTP_USER');
    this.smtp = createTransport({
      host: config.get<string>('SMTP_HOST') ?? 'localhost',
      port,
      secure: port === 465,
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') ?? '' } : undefined,
    });
  }

  /** Sends one email. Returns false instead of throwing, so one failure does not stop a batch. */
  async send(to: string, subject: string, text: string, html: string): Promise<boolean> {
    try {
      if (this.brevoKey) {
        const res = await fetch(BREVO_URL, {
          method: 'POST',
          headers: { 'api-key': this.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            sender: parseFrom(this.from),
            to: [{ email: to }],
            subject,
            textContent: text,
            htmlContent: html,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
      } else {
        await this.smtp!.sendMail({ from: this.from, to, subject, text, html });
      }
      return true;
    } catch (error) {
      this.logger.error(`Could not send "${subject}" to ${to}: ${(error as Error).message}`);
      return false;
    }
  }
}
