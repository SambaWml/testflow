import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail({
  to,
  name,
  orgName,
  email,
  password,
  loginUrl,
}: {
  to: string;
  name: string;
  orgName: string;
  email: string;
  password: string;
  loginUrl: string;
}) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@testflow.app";

  await transporter.sendMail({
    from: `"TestFlow" <${from}>`,
    to,
    subject: `TestFlow — Sua senha foi redefinida (${orgName})`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:32px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:40px;">
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Senha redefinida</h2>
    <p style="color:#64748b;margin:0 0 24px;">Olá, <strong>${name}</strong>. A senha da sua conta na organização <strong>${orgName}</strong> foi redefinida por um administrador.</p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Sua nova senha temporária</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#64748b;padding:4px 0;width:80px;">E-mail</td><td style="color:#0f172a;font-weight:600;">${email}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0;">Senha</td><td style="color:#0f172a;font-weight:600;font-family:monospace;font-size:16px;letter-spacing:.05em;">${password}</td></tr>
      </table>
    </div>

    <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">Acessar o sistema</a>

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">Por segurança, recomendamos alterar sua senha imediatamente após o acesso.</p>
  </div>
</body>
</html>
    `.trim(),
    text: `Olá ${name},\n\nSua senha na organização ${orgName} foi redefinida.\n\nE-mail: ${email}\nNova senha: ${password}\n\nAcesse: ${loginUrl}\n\nRecomendamos alterar sua senha imediatamente após o acesso.`,
  });
}

export async function sendWelcomeEmail({
  to,
  name,
  orgName,
  email,
  password,
  loginUrl,
}: {
  to: string;
  name: string;
  orgName: string;
  email: string;
  password: string;
  loginUrl: string;
}) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@testflow.app";

  await transporter.sendMail({
    from: `"TestFlow" <${from}>`,
    to,
    subject: `Bem-vindo ao TestFlow — Credenciais de acesso (${orgName})`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:32px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e2e8f0;padding:40px;">
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bem-vindo ao TestFlow!</h2>
    <p style="color:#64748b;margin:0 0 24px;">Olá, <strong>${name}</strong>. Sua conta na organização <strong>${orgName}</strong> foi criada com sucesso.</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#1e40af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Suas credenciais</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="color:#64748b;padding:4px 0;width:80px;">E-mail</td><td style="color:#0f172a;font-weight:600;">${email}</td></tr>
        <tr><td style="color:#64748b;padding:4px 0;">Senha</td><td style="color:#0f172a;font-weight:600;font-family:monospace;">${password}</td></tr>
      </table>
    </div>

    <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">Acessar o sistema</a>

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">Por segurança, recomendamos alterar sua senha no primeiro acesso.</p>
  </div>
</body>
</html>
    `.trim(),
    text: `Olá ${name},\n\nSua conta na organização ${orgName} foi criada.\n\nE-mail: ${email}\nSenha: ${password}\n\nAcesse: ${loginUrl}\n\nRecomendamos alterar sua senha no primeiro acesso.`,
  });
}
