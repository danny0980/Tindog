// Sends sign-in emails over SMTP: a magic link (for the website) and a
// 6-digit code (typed into the iOS / Android app, where a link would open the
// browser instead). Without SMTP configured (development), both are printed
// to the server console instead.
export type Mailer = (to: string, link: string, code?: string) => Promise<void>

export async function createMailer(smtpUrl: string | null, from: string, log: (line: string) => void = console.log): Promise<Mailer> {
  if (!smtpUrl) {
    return async (to, link, code) => {
      log(`\n  ✉  Sign-in link for ${to} (no SMTP configured — dev mode):\n     ${link}${code ? `\n     or the code ${code}` : ''}\n`)
    }
  }
  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport(smtpUrl)
  return async (to, link, code) => {
    const codeText = code ? `\n\nIn the app, enter this code instead: ${code}` : ''
    const codeHtml = code ? `<p>In the app, enter this code instead:</p><p style="font:700 28px/1.2 monospace;letter-spacing:6px">${code}</p>` : ''
    await transport.sendMail({
      from,
      to,
      subject: code ? `Your Chronos Chess sign-in code: ${code}` : 'Your Chronos Chess sign-in link',
      text: `Sign in to Chronos Chess:\n\n${link}${codeText}\n\nThis works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<p>Sign in to <b>Chronos Chess</b>:</p><p><a href="${link}">Sign in</a></p>${codeHtml}<p style="color:#666">This works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>`,
    })
  }
}
