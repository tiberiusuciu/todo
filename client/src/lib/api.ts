export interface Todo {
  _id: string;
  title: string;
  notes: string;
  emoji: string;
  completed: boolean;
  parentId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  emojiPending?: boolean;
}

export interface TodoNode extends Todo {
  children: TodoNode[];
}

export type CreateTodoInput = {
  title: string;
  notes?: string;
  parentId?: string | null;
  timezone?: string;
};

export type ReorderItem = { id: string; order: number };

export type UpdateTodoInput = {
  title?: string;
  notes?: string;
  emoji?: string;
  completed?: boolean;
  parentId?: string | null;
  order?: number;
  dueAt?: string | null;
};

const BASE = "/api/todos";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error ?? `Request failed: ${res.status}`, res.status);
  }
  return res.json();
}

export const api = {
  list: () => request<Todo[]>(BASE),
  create: (data: CreateTodoInput) =>
    request<Todo>(BASE, {
      method: "POST",
      body: JSON.stringify({
        ...data,
        timezone: data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }),
  update: (id: string, data: UpdateTodoInput) =>
    request<Todo>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: number }>(`${BASE}/${id}`, { method: "DELETE" }),
  reorder: (items: ReorderItem[]) =>
    request<Todo[]>(`${BASE}/reorder`, { method: "PATCH", body: JSON.stringify({ items }) }),
};
