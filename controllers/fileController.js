import path from "path";
import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import User from "../models/userModel.js";

import {
  generatePreSignedUploadURL,
  generateS3DownloadUrl,
  generateCloudFrontViewUrl,
  deleteS3Object,
  getFileContentLength,
  restoreS3Object,
  softDeleteS3Object,
} from "../services/awsService.js";

/* ============================================================
   DIRECTORY SIZE UPDATE
============================================================ */

export async function updateDirectoriesSize(parentId, deltaSize) {
  while (parentId) {
    const dir = await Directory.findById(parentId);
    if (!dir) break;
    dir.size += deltaSize;
    await dir.save();
    parentId = dir.parentDirId;
  }
}

/* ============================================================
   CREATE UPLOAD SIGNED URL
============================================================ */

export const createuploadSignedUrl = async (req, res, next) => {
  try {
    const parentDirId = req.params.parentDirId || req.user.rootDirId;

    const parentDir = await Directory.findOne({
      _id: parentDirId,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!parentDir) {
      return res.status(404).json({ error: "Parent directory not found" });
    }
      console.log(req.headers);
    const filename = req.headers.filename || "untitled";
    const filesize = Number(req.headers.filesize);
    const type = req.headers.type;
    const contentType = type || "application/octet-stream";

    if (!filesize || isNaN(filesize)) {
      return res.status(400).json({ error: "Invalid filesize" });
    }
    if (!type) {
      return res.status(400).json({ error: "Missing Content-Type" });
    }
 
    const user = await User.findById(req.user._id);
    const rootDir = await Directory.findById(req.user.rootDirId);

    const remainingSpace = user.maxStorageInBytes - rootDir.size;
    if (filesize > remainingSpace) {
      return res.status(400).json({ error: "File too large" });
    }

    const extension = path.extname(filename);

    const file = await File.create({
      name: filename,
      extension,
      size: filesize,
      parentDirId: parentDir._id,
      userId: req.user._id,
      deletedAt: null,
    });

    const s3Key = `${file._id}${extension}`;

    const url = await generatePreSignedUploadURL({
      key: s3Key,
      contentType,
    });

    return res.status(200).json({
      url,
      fileId: file._id,
    });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   GET FILE (VIEW / DOWNLOAD)
============================================================ */

export const getFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
      deletedAt: null,
    }).lean();

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const s3Key = `uploads/active/${file._id}${file.extension}`;

    if (req.query.action === "download") {
      const url = await generateS3DownloadUrl({
        bucket: process.env.AWS_BUCKET_NAME,
        key: s3Key,
        filename: file.name,
      });
      return res.redirect(url);
    }
    const url =  generateCloudFrontViewUrl({ key: s3Key });

    
    // const url = generatePreSignedGetURL({
    //   key: s3Key,
    //   action: req.query.action,
    //   filename: file.name,
    // });

    return res.redirect(url);
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   RENAME FILE
============================================================ */

export const renameFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    file.name = req.body.newFilename;
    await file.save();

    return res.status(200).json({ message: "Renamed successfully" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   HARD DELETE (PERMANENT)
============================================================ */

export const deleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    await deleteS3Object({
      key: `uploads/active/${file._id}${file.extension}`,
    });

    await file.deleteOne();

    return res.status(200).json({ message: "File deleted permanently" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   SOFT DELETE
============================================================ */

export const softDeleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    file.deletedAt = new Date();
    await file.save();

    await softDeleteS3Object({
      key: `${file._id}${file.extension}`,
    });

    await updateDirectoriesSize(file.parentDirId, -file.size);

    return res.status(200).json({ message: "File moved to trash" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   RESTORE FILE
============================================================ */

export const restoreFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
      deletedAt: { $ne: null },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const parentExists = await Directory.exists({
      _id: file.parentDirId,
      userId: req.user._id,
      deletedAt: null,
    });

    if (!parentExists) {
      return res.status(400).json({
        error: "Cannot restore file because parent directory is deleted",
      });
    }

    file.deletedAt = null;
    await file.save();

    await restoreS3Object({
      key: `${file._id}${file.extension}`,
    });

    await updateDirectoriesSize(file.parentDirId, file.size);

    return res.status(200).json({ message: "File restored successfully" });
  } catch (err) {
    next(err);
  }
};

/* ============================================================
   VERIFY UPLOAD
============================================================ */

export const checkfileupload = async (req, res, next) => {
  try {
    const { fileId } = req.body;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found in records" });
    }

    const contentLength = await getFileContentLength({
       key: `uploads/active/${file._id}${file.extension}`,
    });

    if (contentLength !== file.size) {
      await deleteS3Object({
        key: `uploads/active/${file._id}${file.extension}`,
      });
      await file.deleteOne();
      return res.status(400).json({ error: "File upload failed" });
    }

    await updateDirectoriesSize(file.parentDirId, contentLength);

    return res.status(200).json({ message: "File uploaded successfully" });
  } catch (err) {

    next(err);
  }
};


