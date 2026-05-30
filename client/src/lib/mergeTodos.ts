import type { Todo } from "./api";

export function isOptimisticTodo(todo: Todo): boolean {
  return todo._id.startsWith("temp-") || !!todo.emojiPending;
}

function pickTodo(local: Todo, remote: Todo): Todo {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);
  if (localTime > remoteTime) return local;
  return remote;
}

export function mergeTodos(local: Todo[], remote: Todo[]): Todo[] {
  const localById = new Map(local.map((t) => [t._id, t]));
  const merged: Todo[] = [];

  for (const remoteTodo of remote) {
    const localTodo = localById.get(remoteTodo._id);
    if (localTodo && !isOptimisticTodo(localTodo)) {
      merged.push(pickTodo(localTodo, remoteTodo));
    } else {
      merged.push(remoteTodo);
    }
    localById.delete(remoteTodo._id);
  }

  for (const localTodo of localById.values()) {
    if (isOptimisticTodo(localTodo)) merged.push(localTodo);
  }

  return merged;
}

export function todosChanged(a: Todo[], b: Todo[]): boolean {
  if (a.length !== b.length) return true;
  const bById = new Map(b.map((t) => [t._id, t]));
  for (const todo of a) {
    const other = bById.get(todo._id);
    if (!other) return true;
    if (todo.updatedAt !== other.updatedAt) return true;
    if (todo.title !== other.title) return true;
    if (todo.notes !== other.notes) return true;
    if (todo.completed !== other.completed) return true;
    if (todo.parentId !== other.parentId) return true;
    if (todo.order !== other.order) return true;
    if (todo.emoji !== other.emoji) return true;
    if (todo.dueAt !== other.dueAt) return true;
  }
  return false;
}
