import api from "./client"

// Sprint data shape
export interface Sprint {
  id: string
  project_id: string
  name: string
  goal: string
  status: "planning" | "active" | "completed"
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export interface SprintListResponse {
  sprints: Sprint[]
  task_counts: Record<string, number>
}

export interface CreateSprintReq {
  name: string
  goal?: string
  start_date: string
  end_date: string
}

export interface UpdateSprintReq {
  name?: string
  goal?: string
  status?: string
  start_date?: string
  end_date?: string
}

// POST /projects/:id/sprints — create a sprint
export async function createSprint(projectId: string, req: CreateSprintReq) {
  const { data } = await api.post(`/projects/${projectId}/sprints`, req)
  return data
}

// GET /projects/:id/sprints — list project sprints
export async function listSprints(projectId: string) {
  const { data } = await api.get(`/projects/${projectId}/sprints`)
  return data
}

// PUT /projects/:id/sprints/:sprintID — update a sprint
export async function updateSprint(projectId: string, sprintId: string, req: UpdateSprintReq) {
  const { data } = await api.put(`/projects/${projectId}/sprints/${sprintId}`, req)
  return data
}

// DELETE /projects/:id/sprints/:sprintID — delete a sprint
export async function deleteSprint(projectId: string, sprintId: string) {
  const { data } = await api.delete(`/projects/${projectId}/sprints/${sprintId}`)
  return data
}
