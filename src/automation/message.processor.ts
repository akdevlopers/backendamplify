// email.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';

@Processor('email-queue')
export class EmailProcessor {
  @Process('send-email')
  async handleSendEmail(job: Job) {
    const { to, name, subject, body } = job.data;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'youremail@gmail.com',
        pass: 'yourpassword',
      },
    });

    await transporter.sendMail({
      from: '"SaleGrowy" <youremail@gmail.com>',
      to,
      subject,
      html: `<p>${body}</p>`,
    });
  }
}
