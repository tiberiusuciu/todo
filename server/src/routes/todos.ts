import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { Todo } from "../models/Todo.js";
import { suggestEmoji } from "../services/suggestEmoji.js";
import { isValidEmoji } from "../utils/emoji.js";
import { broadcastTodosChanged } from "../sync/broadcast.js";

const router = Router();

function userFilter(req: Request) {
  return { userId: req.user!.id };
}

function notifyTodosChanged(userId: string) {
  broadcastTodosChanged(userId, { type: "todos:changed", at: new Date().toISOString() });
}

async function collectDescendantIds(rootId: string, userId: string): Promise<string[]> {
  const ids = [rootId];
  let queue = [rootId];

  while (queue.length > 0) {
    const children = await Todo.find({ parentId: { $in: queue }, userId }).select("_id");
    const childIds = children.map((c) => c._id.toString());
    ids.push(...childIds);
    queue = childIds;
  }

  return ids;
}

async function wouldCreateCycle(id: string, newParentId: string, userId: string): Promise<boolean> {
  let current: string | null = newParentId;
  while (current) {
    if (current === id) return true;
    const parentDoc: { parentId?: { toString(): string } | null } | null =
      await Todo.findOne({ _id: current, userId }).select("parentId").lean();
    if (!parentDoc) break;
    current = parentDoc.parentId?.toString() ?? null;
  }
  return false;
}

router.get("/", async (req: Request, res: Response) => {
  const todos = await Todo.find(userFilter(req)).sort({ order: 1, createdAt: 1 }).lean();
  res.json(todos);
});

router.post("/", async (req: Request, res: Response) => {
  const { title, notes, parentId, order } = req.body;
  const userId = req.user!.id;

  if (!title?.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  if (parentId && !mongoose.isValidObjectId(parentId)) {
    res.status(400).json({ error: "Invalid parentId" });
    return;
  }

  if (parentId) {
    const parent = await Todo.findOne({ _id: parentId, userId });
    if (!parent) {
      res.status(404).json({ error: "Parent not found" });
      return;
    }
  }

  let resolvedOrder = order;
  if (resolvedOrder === undefined) {
    const siblings = await Todo.find({ parentId: parentId ?? null, userId })
      .sort({ order: -1 })
      .limit(1);
    resolvedOrder = siblings.length > 0 ? siblings[0].order + 1 : 0;
  }

  const emoji = await suggestEmoji(title.trim());

  const todo = await Todo.create({
    title: title.trim(),
    notes: notes ?? "",
    emoji,
    parentId: parentId ?? null,
    userId,
    order: resolvedOrder,
  });

  notifyTodosChanged(userId);
  res.status(201).json(todo);
});

router.patch("/reorder", async (req: Request, res: Response) => {
  const { items } = req.body;
  const userId = req.user!.id;

  if (!Array.isArray(items)) {
    res.status(400).json({ error: "items must be an array" });
    return;
  }

  const ids = items.map(({ id }: { id: string }) => id);
  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
  }

  const owned = await Todo.countDocuments({ _id: { $in: ids }, userId });
  if (owned !== ids.length) {
    res.status(404).json({ error: "One or more todos not found" });
    return;
  }

  const ops = items.map(({ id, order }: { id: string; order: number }) =>
    Todo.findOneAndUpdate({ _id: id, userId }, { order }, { new: true })
  );

  const results = await Promise.all(ops);
  notifyTodosChanged(userId);
  res.json(results.filter(Boolean));
});

router.patch("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.id;
  const { title, notes, emoji, completed, parentId, order } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const todo = await Todo.findOne({ _id: id, userId });
  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400).json({ error: "Title cannot be empty" });
      return;
    }
    todo.title = title.trim();
  }

  if (notes !== undefined) todo.notes = notes;

  if (emoji !== undefined) {
    if (!isValidEmoji(emoji)) {
      res.status(400).json({ error: "Invalid emoji" });
      return;
    }
    todo.emoji = emoji.trim();
  }

  if (completed !== undefined) todo.completed = completed;
  if (order !== undefined) todo.order = order;

  if (parentId !== undefined) {
    if (parentId === null) {
      todo.parentId = null;
    } else {
      if (!mongoose.isValidObjectId(parentId)) {
        res.status(400).json({ error: "Invalid parentId" });
        return;
      }
      if (await wouldCreateCycle(id, parentId, userId)) {
        res.status(400).json({ error: "Cannot set parent: would create cycle" });
        return;
      }
      const parent = await Todo.findOne({ _id: parentId, userId });
      if (!parent) {
        res.status(404).json({ error: "Parent not found" });
        return;
      }
      todo.parentId = parent._id;
    }
  }

  await todo.save();
  notifyTodosChanged(userId);
  res.json(todo);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.id;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const todo = await Todo.findOne({ _id: id, userId });
  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  const idsToDelete = await collectDescendantIds(id, userId);
  await Todo.deleteMany({ _id: { $in: idsToDelete }, userId });
  notifyTodosChanged(userId);
  res.json({ deleted: idsToDelete.length });
});

export default router;
