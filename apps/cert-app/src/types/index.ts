export interface WhatsAppReport {
  id?: number;
  phone: string;
  cert_key?: string;
  message: string;
  created_at: string;
}

export interface ProfileCert {
  certId: string;
  batchId: string;
  batchName: string;
  recipientName: string;
  r2PdfUrl: string | null;
  pdfUrl: string | null;
  slideUrl: string | null;
  issuedAt: string | null;
  status: string;
}

export interface ProfileData {
  slug: string;
  name: string;
  certificates: ProfileCert[];
}

export interface VerifyCertData {
  id: string;
  recipientName: string;
  status: string;
  batchName: string;
  issuedAt: string | null;
  r2PdfUrl: string | null;
  pdfUrl: string | null;
  slideUrl: string | null;
}
