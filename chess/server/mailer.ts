// Sends magic-link emails over SMTP. Without SMTP configured (development),
// the link is printed to the server console instead.
export type Mailer = (to: string, link: string) => Promise<void>

export async function createMailer(smtpUrl: string | null, from: string, log: (line: string) => void = console.log): Promise<Mailer> {
  if (!smtpUrl) {
    return async (to, link) => {
      log(`\n  ✉  Sign-in link for ${to} (no SMTP configured — dev mode):\n     ${link}\n`)
    }
  }
  const nodemailer = await import('nodemailer')
  const transport = nodemailer.createTransport(smtpUrl)
  return async (to, link) => {
    await transport.sendMail({
      from,
      to,
      subject: 'Your Chronos Chess sign-in link',
      text: `Sign in to Chronos Chess:\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<p>Sign in to <b>Chronos Chess</b>:</p><p><a href="${link}">Sign in</a></p><p style="color:#666">This link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>`,
    })
  }
}
