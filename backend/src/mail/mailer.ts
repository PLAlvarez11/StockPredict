import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

export interface Mailer {
  enviar(correo: Correo): Promise<void>;
}

export function crearSmtpMailer(): Mailer {
  const transporte = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
  });
  return {
    async enviar(correo) {
      await transporte.sendMail({
        from: env.MAIL_FROM,
        to: correo.para,
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
      });
    },
  };
}

export function correoRecuperacion(
  para: string,
  nombre: string,
  enlace: string,
  minutos: number,
): Correo {
  const texto = [
    `Hola ${nombre},`,
    '',
    'Recibimos una solicitud para restablecer tu contraseña de StockPredict.',
    `Abre este enlace (vale ${minutos} minutos y solo se puede usar una vez):`,
    enlace,
    '',
    'Si no la solicitaste, ignora este mensaje.',
  ].join('\n');
  const html = `<p>Hola ${escapar(nombre)},</p>
<p>Recibimos una solicitud para restablecer tu contraseña de StockPredict.</p>
<p><a href="${escapar(enlace)}">Restablecer mi contraseña</a></p>
<p>El enlace vale ${minutos} minutos y solo se puede usar una vez. Si no lo solicitaste, ignora este mensaje.</p>`;
  return { para, asunto: 'Restablece tu contraseña de StockPredict', texto, html };
}

function escapar(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
