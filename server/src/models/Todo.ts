import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITodo extends Document {
  title: string;
  notes: string;
  emoji: string;
  completed: boolean;
  parentId: Types.ObjectId | null;
  userId: Types.ObjectId | null;
  order: number;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const todoSchema = new Schema<ITodo>(
  {
    title: { type: String, required: true, trim: true },
    notes: { type: String, default: "" },
    emoji: { type: String, default: "" },
    completed: { type: Boolean, default: false },
    parentId: { type: Schema.Types.ObjectId, ref: "Todo", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    order: { type: Number, default: 0 },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true }
);

todoSchema.index({ userId: 1, parentId: 1, order: 1 });

export const Todo = mongoose.model<ITodo>("Todo", todoSchema);
