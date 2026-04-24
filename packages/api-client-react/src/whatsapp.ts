import { useMutation, UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ─── Individual certificate send ─────────────────────────────────────────────

export interface SendCertEmailRequest {
  emailSubject?: string;
  emailBody?: string;
}

export interface SendCertEmailResponse {
  success: boolean;
  message: string;
}

export const sendCertEmail = async (
  batchId: string,
  certId: string,
  data: SendCertEmailRequest,
): Promise<SendCertEmailResponse> => {
  return customFetch<SendCertEmailResponse>(
    `/api/batches/${batchId}/certificates/${certId}/send`,
    { method: "POST", body: JSON.stringify(data) },
  );
};

export const useSendCertEmail = (options?: {
  mutation?: UseMutationOptions<
    SendCertEmailResponse,
    Error,
    { batchId: string; certId: string; data: SendCertEmailRequest }
  >;
}) => {
  return useMutation({
    ...options?.mutation,
    mutationFn: ({ batchId, certId, data }) => sendCertEmail(batchId, certId, data),
  });
};

export interface SendCertWhatsappRequest {
  var1Template: string;
  var2Template: string;
  var3Template?: string;
}

export interface SendCertWhatsappResponse {
  success: boolean;
  message: string;
}

export const sendCertWhatsapp = async (
  batchId: string,
  certId: string,
  data: SendCertWhatsappRequest,
): Promise<SendCertWhatsappResponse> => {
  return customFetch<SendCertWhatsappResponse>(
    `/api/batches/${batchId}/certificates/${certId}/send-whatsapp`,
    { method: "POST", body: JSON.stringify(data) },
  );
};

export const useSendCertWhatsapp = (options?: {
  mutation?: UseMutationOptions<
    SendCertWhatsappResponse,
    Error,
    { batchId: string; certId: string; data: SendCertWhatsappRequest }
  >;
}) => {
  return useMutation({
    ...options?.mutation,
    mutationFn: ({ batchId, certId, data }) => sendCertWhatsapp(batchId, certId, data),
  });
};

export interface SendBatchWhatsappRequest {
  var1Template: string;
  var2Template: string;
  var3Template?: string;
}

export interface SendBatchWhatsappResponse {
  success: boolean;
  message: string;
  processed: number;
  failed: number;
}

export const sendBatchWhatsapp = async (
  batchId: string,
  data: SendBatchWhatsappRequest,
): Promise<SendBatchWhatsappResponse> => {
  return customFetch<SendBatchWhatsappResponse>(
    `/api/batches/${batchId}/send-whatsapp`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
};

export const useSendBatchWhatsapp = (options?: {
  mutation?: UseMutationOptions<
    SendBatchWhatsappResponse,
    Error,
    { batchId: string; data: SendBatchWhatsappRequest }
  >;
}) => {
  return useMutation({
    ...options?.mutation,
    mutationFn: ({ batchId, data }) => sendBatchWhatsapp(batchId, data),
  });
};
