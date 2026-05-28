import type { Todo, TodoNode } from "./api";

export type { TodoNode };

export function buildTree(flat: Todo[]): TodoNode[] {
  const map = new Map<string, TodoNode>();
  const roots: TodoNode[] = [];

  for (const todo of flat) {
    map.set(todo._id, { ...todo, children: [] });
  }

  for (const todo of flat) {
    const node = map.get(todo._id)!;
    if (todo.parentId && map.has(todo.parentId)) {
      map.get(todo.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: TodoNode[]) => {
    nodes.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    nodes.forEach((n) => sortNodes(n.children));
  };

  sortNodes(roots);
  return roots;
}

export function hasChildren(node: TodoNode): boolean {
  return node.children.length > 0;
}

export function filterCompleted(nodes: TodoNode[]): TodoNode[] {
  const result: TodoNode[] = [];

  for (const node of nodes) {
    const children = filterCompleted(node.children);
    if (node.completed) {
      result.push(...children);
    } else {
      result.push({ ...node, children });
    }
  }

  return result;
}

export function countCompleted(nodes: TodoNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.completed) count++;
    count += countCompleted(node.children);
  }
  return count;
}

export type DirectChildProgress = { done: number; total: number };

export function buildDirectChildProgressMap(
  nodes: TodoNode[]
): Map<string, DirectChildProgress> {
  const map = new Map<string, DirectChildProgress>();

  function walk(list: TodoNode[]) {
    for (const node of list) {
      if (node.children.length > 0) {
        map.set(node._id, {
          done: node.children.filter((c) => c.completed).length,
          total: node.children.length,
        });
      }
      walk(node.children);
    }
  }

  walk(nodes);
  return map;
}
