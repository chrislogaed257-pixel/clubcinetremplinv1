/**
 * Petit client SMTP (TLS implicite, port 465) pour l'envoi via une boîte Gmail
 * du club avec un mot de passe d'application. Aucun identifiant n'est stocké
 * ici : ils proviennent uniquement des secrets du projet.
 */

type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  replyTo: string;
  to: string;
  subject: string;
  body: string;
};

function b64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function encodeHeader(value: string) {
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}

export async function sendViaSmtp(opts: SmtpOptions): Promise<void> {
  const tls = await import("node:tls");

  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host: opts.host, port: opts.port, servername: opts.host });
    let buffer = "";
    let step = 0;
    let done = false;

    const message = [
      `From: ${encodeHeader(opts.fromName)} <${opts.from}>`,
      `To: ${opts.to}`,
      `Reply-To: ${opts.replyTo || opts.from}`,
      `Subject: ${encodeHeader(opts.subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      opts.body.replace(/\r?\n\./g, "\n.."),
      ".",
    ].join("\r\n");

    const steps: string[] = [
      `EHLO cinetremplin`,
      "AUTH LOGIN",
      b64(opts.user),
      b64(opts.pass),
      `MAIL FROM:<${opts.from}>`,
      `RCPT TO:<${opts.to}>`,
      "DATA",
      message,
      "QUIT",
    ];

    const fail = (err: Error) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {
        /* rien */
      }
      reject(err);
    };

    socket.setEncoding("utf8");
    socket.setTimeout(20000, () => fail(new Error("Délai dépassé avec le serveur Gmail")));
    socket.on("error", (e) => fail(e as Error));

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      if (!/\r\n$/.test(buffer)) return;
      const lines = buffer.trim().split(/\r\n/);
      const last = lines[lines.length - 1] ?? "";
      buffer = "";
      const code = Number(last.slice(0, 3));
      if (code >= 400) return fail(new Error(`Gmail a refusé : ${last}`));
      const next = steps[step++];
      if (next === undefined) return;
      socket.write(next + "\r\n");
      if (next === "QUIT") {
        done = true;
        socket.end();
        resolve();
      }
    });
  });
}
