declare module 'nodemailer' {
  export interface Transporter {
    sendMail(mailOptions: Record<string, unknown>): Promise<unknown>;
  }

  export interface CreateTransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user?: string;
      pass?: string;
    };
    tls?: Record<string, unknown>;
  }

  export function createTransport(options?: CreateTransportOptions): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}

declare module 'nodemailer/lib/mail-composer' {
  export interface MailComposerOptions {
    [key: string]: unknown;
  }

  export default class MailComposer {
    constructor(options?: MailComposerOptions);
    compile(): {
      build(callback?: (err: Error | null, message: Buffer) => void): Promise<Buffer> | void;
    };
  }
}
