import path from "path";
import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import User from "../models/userModel.js";
import {
  generatePreSignedUploadURL,
  generatePreSigendGetURL,
  deleteS3Object,
  getFileContentLength,
  restoreS3Object,
  softDeleteS3Object
} from "../services/awsService.js";

export async function updateDirectoriesSize(parentId, deltaSize) {
  console.log("runninf update size");
  while (parentId) {
    const dir = await Directory.findById(parentId);
    dir.size += deltaSize;
    await dir.save();
    parentId = dir.parentDirId;
  }
}

export const createuploadSignedUrl = async (req, res, next) => {
  const parentDirId = req.params.parentDirId || req.user.rootDirId;
  try {
    const parentDirData = await Directory.findOne({
      _id: parentDirId,
      userId: req.user._id,
    });

    if (!parentDirData) {
      return res.status(404).json({ error: "Parent directory not found!" });
    }

    const filename = req.headers.filename || "untitled";
    const filesize = Number(req.headers.filesize);
    const type = req.headers.type;

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
      console.log("File too large");
      return res.status(400).json({ error: "File too large" });
    }

    const extension = path.extname(filename);

    const insertedFile = await File.insertOne({
      extension,
      name: filename,
      size: filesize,
      parentDirId: parentDirData._id,
      userId: req.user._id,
    });

    // Adjust this depending on your DB driver
    const fileId = insertedFile.insertedId || insertedFile._id || insertedFile.id;

    const fullFileName = `uploads/active/${fileId}${extension}`;
    const url = await generatePreSignedUploadURL({ Key: fullFileName, ContentType: type });

    res.status(200).json({
      url,
      fileId,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};


export const getFile = async (req, res) => {
  const { id } = req.params;
  const fileData = await File.findOne({
    _id: id,
    userId: req.user._id,
  }).lean();

  if (!fileData) {
    return res.status(404).json({ error: "File not found!" });
  }

  const filePath = `uploads/active/${id}${fileData.extension}`;

  const url = await generatePreSigendGetURL(
   { Key: filePath,
    Action : req.query.action,
   Filename: fileData.name}
  );
  return res.redirect(url);
};

export const renameFile = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
  });

  // Check if file exists
  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }

  try {
    file.name = req.body.newFilename;
    await file.save();
    return res.status(200).json({ message: "Renamed" });
  } catch (err) {
    console.log(err);
    err.status = 500;
    next(err);
  }
};

export const deleteFile = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }

  try {
    await deleteS3Object(`{id.$file.extension}`);
    await file.deleteOne();
    return res.status(200).json({ message: "File Deleted Successfully" });
  } catch (err) {
    next(err);
  }
};

export const softDeleteFile = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
    deletedAt: null,
  });
  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }

  try {
    file.deletedAt = new Date();
    await file.save();
    await softDeleteS3Object({ Key: `${file.id}${file.extension}` });
    await updateDirectoriesSize(file.parentDirId, -file.size);
    return res.status(200).json({ message: "File Deleted Successfully" });
  } catch (err) {
    next(err);
  }
};

export const restoreFile = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
    deletedAt: { $ne: null },
  });
  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }

  if(!await Directory.findOne({_id:file.parentDirId,userId:req.user._id,deletedAt:null}).lean()){
    return  res.status(400).json({ error: "Cannot restore file as parent directory is deleted." });
  }

  try {
    await File.updateOne({ _id: id }, { deletedAt: null });
    await updateDirectoriesSize(file.parentDirId, file.size);
    await restoreS3Object({ Key: `${file.id}${file.extension}` });
    return res.status(200).json({ message: "File Restored Successfully" });
  } catch (err) {
    next(err);
  }
};

export const checkfileupload = async (req, res, next) => {

  try{
     const file = await File.findById(req.body.fileId);
  if (!file) {
    return res.json({ error: "file not found at pur record" });
  }
  const contentLength = await getFileContentLength(
    { Key: `${file.id}${file.extension}` }
  );
  if (contentLength != file.size) {
    req.params = { id: file.id };
    await deleteFile(req, res, next);
    return res.status("400").json({ error: "file not uploaded" });
  }
  await updateDirectoriesSize(file.parentDirId, parseInt(contentLength));

  return res.status(200).json({ message: "file uploaded successfully " });
  }
 catch(err){ 
    next(err);
  }
};
