const ZEPTO_API = "https://api.zeptomail.in/v1.1/email";
const FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL || "certificate@cephlow.in";
const FROM_NAME = "Cephlow Certificates";

export async function sendEmail(
  _uid: string,
  {
    to,
    subject,
    body,
    pdfBuffer,
    pdfFilename,
  }: {
    to: string;
    subject: string;
    body: string;
    pdfBuffer?: Buffer;
    pdfFilename?: string;
  }
) {
  const payload: Record<string, unknown> = {
    from: { address: FROM_EMAIL, name: FROM_NAME },
    to: [{ email_address: { address: to } }],
    subject,
    textbody: body,
  };

  if (pdfBuffer) {
    payload.attachments = [
      {
        content: pdfBuffer.toString("base64"),
        mime_type: "application/pdf",
        name: pdfFilename || "certificate.pdf",
      },
    ];
  }

  const res = await fetch(ZEPTO_API, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": process.env.ZEPTOMAIL_TOKEN!,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`ZeptoMail error ${res.status}: ${JSON.stringify(err)}`);
  }
}