import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

export interface Decision {
  summary: string;
  context?: string | null;
}

export interface ActionItem {
  task: string;
  owner: string;
  due_date?: string | null;
  priority?: "high" | "medium" | "low" | string;
}

export interface MeetingExtraction {
  meeting_title?: string;
  meeting_summary: string;
  decisions: Decision[];
  action_items: ActionItem[];
  open_questions: string[];
}

export interface ExtractionHistoryItem {
  id: string;
  created_at: string;
  source_name: string;
  source_type: "file" | "text" | string;
  extraction: MeetingExtraction;
}

export interface EmailDraftRequest {
  meeting_title?: string;
  meeting_summary: string;
  decisions: Decision[];
  action_items: ActionItem[];
  open_questions: string[];
  recipient_name?: string;
  sender_name?: string;
  tone?: "professional" | "concise" | "casual";
}

export interface EmailDraftResponse {
  subject: string;
  body: string;
}

export async function extractFromFile(file: File, title?: string): Promise<ExtractionHistoryItem> {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);

  const response = await api.post<ExtractionHistoryItem>("/extract", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function extractFromText(text: string, title?: string): Promise<ExtractionHistoryItem> {
  const formData = new FormData();
  formData.append("text", text);
  if (title) formData.append("title", title);

  const response = await api.post<ExtractionHistoryItem>("/extract", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function draftEmail(payload: EmailDraftRequest): Promise<EmailDraftResponse> {
  const response = await api.post<EmailDraftResponse>("/draft-email", payload);
  return response.data;
}

export async function getHistory(): Promise<ExtractionHistoryItem[]> {
  const response = await api.get<ExtractionHistoryItem[]>("/history");
  return response.data;
}

export async function getHistoryItem(id: string): Promise<ExtractionHistoryItem> {
  const response = await api.get<ExtractionHistoryItem>(`/history/${id}`);
  return response.data;
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await api.delete(`/history/${id}`);
}

export async function getSampleTranscript(): Promise<{ title: string; transcript: string }> {
  const response = await api.get<{ title: string; transcript: string }>("/sample");
  return response.data;
}

export async function checkBackendHealth(): Promise<{ status: string; groq_configured: boolean; model: string }> {
  const response = await api.get("/health");
  return response.data;
}
