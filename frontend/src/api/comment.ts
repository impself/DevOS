import api from "./client"

// Comment data shape
export interface Comment {
  id: string
  task_id: string
  user_id: string
  content: string
  username: string
  nickname: string
  avatar: string
  created_at: string
  updated_at: string
}

// POST /projects/:id/tasks/:taskID/comments — create comment
export async function createComment(projectId: string, taskId: string, content: string) {
  const { data } = await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { content })
  return data
}

// GET /projects/:id/tasks/:taskID/comments — list comments
export async function listComments(projectId: string, taskId: string) {
  const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/comments`)
  return data as { code: number; message: string; data: Comment[] }
}

// DELETE /projects/:id/tasks/:taskID/comments/:commentID — delete comment
export async function deleteComment(projectId: string, taskId: string, commentId: string) {
  const { data } = await api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`)
  return data
}
