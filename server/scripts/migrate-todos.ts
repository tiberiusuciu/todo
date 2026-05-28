/**
 * Merge-import todos from a local Mongo export into a target user account.
 *
 * Export locally (replace LOCAL_USER_ID):
 *   docker exec todo-app-mongo-1 mongosh todos --quiet --eval "
 *     EJSON.stringify(
 *       db.todos.find({ userId: ObjectId('LOCAL_USER_ID') }).toArray()
 *     )
 *   " > todos-export.json
 *
 * Import on VPS (replace PROD_USER_ID, from repo root):
 *   docker compose -f docker-compose.prod.yml run --rm --no-deps \
 *     -v "$(pwd)/todos-export.json:/data/todos-export.json:ro" \
 *     -v "$(pwd)/server:/app" -w /app \
 *     node:22-alpine sh -c "npm ci && MONGODB_URI=mongodb://mongo:27017/todos npx tsx scripts/migrate-todos.ts --file /data/todos-export.json --user-id PROD_USER_ID"
 *
 * Dry run:
 *   ... npx tsx scripts/migrate-todos.ts --file /data/todos-export.json --user-id PROD_USER_ID --dry-run
 */

import { readFileSync } from "fs";
import { EJSON, ObjectId } from "bson";
import mongoose from "mongoose";

interface ExportedTodo {
  _id: ObjectId;
  title: string;
  notes?: string;
  emoji?: string;
  completed?: boolean;
  parentId?: ObjectId | null;
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let file = "";
  let userId = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) file = args[++i];
    else if (args[i] === "--user-id" && args[i + 1]) userId = args[++i];
    else if (args[i] === "--dry-run") dryRun = true;
  }

  if (!file || !userId) {
    console.error("Usage: tsx scripts/migrate-todos.ts --file <path> --user-id <ObjectId> [--dry-run]");
    process.exit(1);
  }
  if (!ObjectId.isValid(userId)) {
    console.error("Invalid --user-id");
    process.exit(1);
  }

  return { file, userId: new ObjectId(userId), dryRun };
}

function sortForInsert(todos: ExportedTodo[]): ExportedTodo[] {
  const sorted: ExportedTodo[] = [];
  const done = new Set<string>();

  while (sorted.length < todos.length) {
    let progress = false;
    for (const todo of todos) {
      const id = todo._id.toString();
      if (done.has(id)) continue;

      const parentId = todo.parentId?.toString() ?? null;
      if (parentId && !done.has(parentId)) continue;

      sorted.push(todo);
      done.add(id);
      progress = true;
    }
    if (!progress) {
      throw new Error("Could not order todos (cycle or missing parent in export)");
    }
  }

  return sorted;
}

async function main() {
  const { file, userId, dryRun } = parseArgs();
  const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/todos";

  const raw = readFileSync(file, "utf8");
  const todos = EJSON.parse(raw) as ExportedTodo[];

  if (!Array.isArray(todos) || todos.length === 0) {
    console.error("Export file is empty or not a todo array");
    process.exit(1);
  }

  const ordered = sortForInsert(todos);
  const idMap = new Map<string, ObjectId>();
  const docs = ordered.map((todo) => {
    const newId = new ObjectId();
    idMap.set(todo._id.toString(), newId);

    const parentKey = todo.parentId?.toString() ?? null;
    const parentId = parentKey ? idMap.get(parentKey) ?? null : null;

    if (parentKey && !parentId) {
      throw new Error(`Missing parent mapping for ${parentKey}`);
    }

    return {
      _id: newId,
      title: todo.title,
      notes: todo.notes ?? "",
      emoji: todo.emoji ?? "",
      completed: todo.completed ?? false,
      parentId,
      userId,
      order: todo.order ?? 0,
      createdAt: todo.createdAt ?? new Date(),
      updatedAt: todo.updatedAt ?? new Date(),
    };
  });

  console.log(`Prepared ${docs.length} todos for user ${userId.toString()}`);

  if (dryRun) {
    console.log("Dry run — no writes performed");
    return;
  }

  await mongoose.connect(uri);
  const existing = await mongoose.connection.collection("todos").countDocuments({ userId });
  console.log(`Existing todos for user: ${existing}`);

  await mongoose.connection.collection("todos").insertMany(docs);
  const after = await mongoose.connection.collection("todos").countDocuments({ userId });
  console.log(`Inserted ${docs.length} todos. Total for user now: ${after}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
