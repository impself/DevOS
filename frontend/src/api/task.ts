import api from "./client"

// Task data shape
export interface Task {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  description: string
  type: string // task / bug / feature / improvement
  status: string // backlog / todo / in_progress / in_review / done / cancelled
  priority: string // none / low / medium / high / critical
  story_points: number | null
  due_date: string | null
  assignee_id: string | null
  created_by: string
  sprint_id: string | null
  sort_order: number
  assignee_name: string
  creator_name: string
  assignee_email: string
  created_at: string
  updated_at: string
}

export interface TaskListResponse {
  code: number
  message: string
  data: Task[]
  pagination: { page: number; page_size: number; total: number }
}

export interface CreateTaskReq {
  title: string
  description?: string
  type?: string
  priority?: string
  assignee_id?: string
  parent_id?: string
}

export interface UpdateTaskReq {
  title?: string
  description?: string
  type?: string
  status?: string
  priority?: string
  assignee_id?: string
  story_points?: number
  due_date?: string
  sort_order?: number
}

export interface TaskFilters {
  status?: string
  priority?: string
  type?: string
  assignee?: string
  sprint_id?: string
  parent_id?: string
  search?: string
  page?: number
  page_size?: number
}

// POST /projects/:id/tasks — create a task
export async function createTask(projectId: string, req: CreateTaskReq) {
  const { data } = await api.post(`/projects/${projectId}/tasks`, req)
  return data
}

// GET /projects/:id/tasks — list tasks with filters
export async function listTasks(projectId: string, filters?: TaskFilters) {
  const { data } = await api.get<TaskListResponse>(`/projects/${projectId}/tasks`, {
    params: filters,
  })
  return data
}

// GET /projects/:id/tasks/:taskID — get single task
export async function getTask(projectId: string, taskId: string) {
  const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}`)
  return data
}

// PUT /projects/:id/tasks/:taskID — update a task
export async function updateTask(projectId: string, taskId: string, req: UpdateTaskReq) {
  const { data } = await api.put(`/projects/${projectId}/tasks/${taskId}`, req)
  return data
}

// DELETE /projects/:id/tasks/:taskID — delete a task
export async function deleteTask(projectId: string, taskId: string) {
  const { data } = await api.delete(`/projects/${projectId}/tasks/${taskId}`)
  return data
}
