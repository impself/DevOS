import api from "./client"

// Tag data shape
export interface Tag {
  id: string
  project_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

// POST /projects/:id/tags — create a tag
export async function createTag(projectId: string, req: { name: string; color?: string }) {
  const { data } = await api.post(`/projects/${projectId}/tags`, req)
  return data
}

// GET /projects/:id/tags — list project tags
export async function listTags(projectId: string) {
  const { data } = await api.get(`/projects/${projectId}/tags`)
  return data
}

// PUT /projects/:id/tags/:tagID — update a tag
export async function updateTag(projectId: string, tagId: string, req: { name?: string; color?: string }) {
  const { data } = await api.put(`/projects/${projectId}/tags/${tagId}`, req)
  return data
}

// DELETE /projects/:id/tags/:tagID — delete a tag
export async function deleteTag(projectId: string, tagId: string) {
  const { data } = await api.delete(`/projects/${projectId}/tags/${tagId}`)
  return data
}

// PUT /projects/:id/tasks/:taskID/tags — set task tags (full replace)
export async function setTaskTags(projectId: string, taskId: string, tagIds: string[]) {
  const { data } = await api.put(`/projects/${projectId}/tasks/${taskId}/tags`, { tag_ids: tagIds })
  return data
}
