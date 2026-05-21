import api from "./client"

// Project data shape returned by backend
export interface Project {
  id: string
  name: string
  description: string
  owner_id: string
  workspace_id: string
  created_at: string
  updated_at: string
  task_total?: number
  task_done?: number
}

// Member data shape for project membership
export interface Member {
  id: string
  project_id: string
  user_id: string
  role: string
  username: string
  email: string
  nickname: string
  avatar: string
  joined_at: string
}

// Paginated project list response
export interface ProjectListResponse {
  code: number
  message: string
  data: Project[]
  pagination: { page: number; page_size: number; total: number }
}

// POST /projects — create a new project
export async function createProject(name: string, description: string) {
  const { data } = await api.post("/projects", { name, description })
  return data
}

// GET /projects — list projects for current user with pagination
export async function listProjects(page = 1, pageSize = 20): Promise<ProjectListResponse> {
  const { data } = await api.get<ProjectListResponse>("/projects", {
    params: { page, page_size: pageSize },
  })
  return data
}

// GET /projects/:id — get single project detail
export async function getProject(id: string) {
  const { data } = await api.get(`/projects/${id}`)
  return data
}

// PUT /projects/:id — update project name and description
export async function updateProject(id: string, name: string, description: string) {
  const { data } = await api.put(`/projects/${id}`, { name, description })
  return data
}

// DELETE /projects/:id — delete a project (owner only)
export async function deleteProject(id: string) {
  const { data } = await api.delete(`/projects/${id}`)
  return data
}

// POST /projects/:id/members — add a member to project
export async function addMember(projectId: string, username: string, role: string) {
  const { data } = await api.post(`/projects/${projectId}/members`, { username, role })
  return data
}

// DELETE /projects/:id/members/:memberID — remove a member from project
export async function removeMember(projectId: string, memberId: string) {
  const { data } = await api.delete(`/projects/${projectId}/members/${memberId}`)
  return data
}

// GET /projects/:id/members — list all members of a project
export async function listMembers(projectId: string) {
  const { data } = await api.get(`/projects/${projectId}/members`)
  return data
}

// PUT /projects/:id/members/:memberID/role — update a member's role
export async function updateMemberRole(projectId: string, userId: string, role: string) {
  const { data } = await api.put(`/projects/${projectId}/members/${userId}/role`, { role })
  return data
}

// User data shape returned by /users endpoint
export interface UserItem {
  id: string
  email: string
  username: string
  nickname: string
  avatar: string
  role: string
}

// GET /users — list all users for member picker
export async function listUsers() {
  const { data } = await api.get("/users")
  return data as { code: number; message: string; data: UserItem[] }
}
