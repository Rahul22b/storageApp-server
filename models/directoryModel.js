import { model, Schema } from "mongoose";

const directorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      default: 0,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    parentDirId: {
      type: Schema.Types.ObjectId,
      default: null,
      ref: "Directory",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    isparentInRecycleBin: {
      type: Boolean,
      default: false,
      index: true
    },
  },
  {
    strict: "throw",
    timestamps: true,
  }
);

const Directory = model("Directory", directorySchema);

export default Directory;
