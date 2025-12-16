import { model, Schema } from "mongoose";

const fileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // Remove whitespace from both ends
      minlength: [1, 'File name cannot be empty.'],
    },
    size: {
      type: Number,
      required: true,
      min: [0, 'File size cannot be negative.'] // Ensure size is not negative
    },
    extension: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      // Ensure extension starts with '.' and has length > 1
      validate: {
        validator: function(v) {
          return v.length > 1 && v.startsWith('.');
        },
        message: props => `${props.value} is not a valid file extension format (e.g., .png).`
      }
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    parentDirId: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
      default: null // Explicitly set default for clarity
    },
    deletedAt: {
      type: Schema.Types.Date,
      default: null,
    }
  },
  {
    strict: "throw", // Ensures Mongoose throws an error if an invalid field is passed
    timestamps: true,
  }
);

const File = model("File", fileSchema);
export default File;