import * as nodemailer from 'nodemailer';

import EmailOptions from 'interfaces/email.interface';

const sendEmail = async (options: EmailOptions) => {
  // 1) Create Transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    secure: true,
    port: 465,

    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },

    tls: { ciphers: 'SSLv3' },
  });

  // 2) Define Options
  const mailOptions = {
    from: `Unimart ${process.env.SMTP_EMAIL}`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? undefined,
  };

  // 3) Send Email
  await transporter.sendMail(mailOptions);
};

export default sendEmail;
