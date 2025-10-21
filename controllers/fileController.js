import path from "path";
import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import User from "../models/userModel.js";
import  { Storage } from '@google-cloud/storage'
import credential from '../storage-app-463917-7328073a67f1.json' with { type: "json" };

const storage=new Storage({
  credentials: credential,
  projectId :"storage-app-463917"
})
 

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
    const filesize = req.headers.filesize;
    const type = req.headers.type;
    const user = await User.findById(req.user._id);
    const rootDir = await Directory.findById(req.user.rootDirId);
    const remainingSpace = user.maxStorageInBytes - rootDir.size;

    if (filesize > remainingSpace) {
      console.log("File too large");
      return res.destroy();
    }

    const extension = path.extname(filename);

    const insertedFile = await File.insertOne({
      extension,
      name: filename,
      size: filesize,
      parentDirId: parentDirData._id,
      userId: req.user._id,
    }); 

    const fileId = insertedFile.id;

    const fullFileName = `${fileId}${extension}`;
      const options = {
    version: 'v4',
    action: 'write',
   contentType:type,
    expires: Date.now() + 15 * 60 * 1000,  
  };


  const [url]= await storage
    .bucket('chiku22b')
    .file(fullFileName) 
    .getSignedUrl(options);
    
   res.status(200).json({
    url,
    fileId
   })

  } catch (err) {
    console.log(err);
    next(err);
  }
};


async function createGetSignedUrl(filePath, download) {
  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, 
    ...(download ? {
       responseDisposition: `attachment; filename="${encodeURIComponent(filePath)}"`
    } : {
       responseDisposition: 'inline'
    })
  };

  const [url] = await storage
    .bucket('chiku22b')
    .file(filePath)
    .getSignedUrl(options);

  return url;
}


export const getFile = async (req, res) => {
    const { id } = req.params;
    const fileData = await File.findOne({
        _id: id,
        userId: req.user._id,
    }).lean();

    if (!fileData) {
        return res.status(404).json({ error: "File not found!" });
    }

    const filePath = `${id}${fileData.extension}`;
     
   

    if (req.query.action === "download") {
     const url=await createGetSignedUrl(filePath,true)
        return res.redirect(url);
    }  
     const url=await createGetSignedUrl(filePath,false);
     console.log(url);
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
    await file.deleteOne();
    await updateDirectoriesSize(file.parentDirId, -file.size);
    await storage.bucket('chiku22b').file(`${file.id}${file.extension}`).delete();
    return res.status(200).json({ message: "File Deleted Successfully" });
  } catch (err) {
    next(err);
  }
};

export const checkfileupload=async (req,res,next)=>{ 
const file=await File.findById(req.body.fileId);
if(!file){
  return res.json({'error':"file not found at pur record"});
  }
const [metadata] = await storage.bucket('chiku22b').file(`${file.id}${file.extension}`).getMetadata();
  if(metadata.size!=file.size){
    req.params = { id: file.id }; 
   await deleteFile(req,res,next);
   return res.status('400').json({'error':'file not uploaded'});
  }
await updateDirectoriesSize(file.parentDirId,parseInt(metadata.size));

return res.status(200).json({'message':'file uploaded successfully '})
}

