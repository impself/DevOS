import api from "./client"

// Document data shape
export interface Document {
  id: string
  project_id: string
  title: string
  content: Record<string, unknown> | null
  created_by: string
  creator_name: string
  creator_nickname: string
  created_at: string
  updated_at: string
}

export interface DocumentListResponse {
  code: number
  message: string
  data: Document[]
  pagination: { page: number; page_size: number; total: number }
}

export interface CreateDocumentReq {
  title: string
  content?: Record<string, unknown>
}

export interface UpdateDocumentReq {
  title?: string
  content?: Record<string, unknown>
}

// POST /projects/:id/documents — create document
export async function createDocument(projectId: string, req: CreateDocumentReq) {
  const { data } = await api.post(`/projects/${projectId}/documents`, req)
  return data
}

// GET /projects/:id/documents — list documents
export async function listDocuments(projectId: string, params?: { search?: string; page?: number; page_size?: number }) {
  const { data } = await api.get<DocumentListResponse>(`/projects/${projectId}/documents`, { params })
  return data
}

// GET /projects/:id/documents/:docID — get single document
export async function getDocument(projectId: string, docId: string) {
  const { data } = await api.get(`/projects/${projectId}/documents/${docId}`)
  return data
}

// PUT /projects/:id/documents/:docID — update document
export async function updateDocument(projectId: string, docId: string, req: UpdateDocumentReq) {
  const { data } = await api.put(`/projects/${projectId}/documents/${docId}`, req)
  return data
}

// DELETE /projects/:id/documents/:docID — delete document
export async function deleteDocument(projectId: string, docId: string) {
  const { data } = await api.delete(`/projects/${projectId}/documents/${docId}`)
  return data
}
