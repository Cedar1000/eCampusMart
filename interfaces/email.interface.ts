interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  replyTo?: string;
  text: string;
  attachments?: any;
  altText?: string;
}

export default EmailOptions;
