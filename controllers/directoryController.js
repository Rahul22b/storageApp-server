import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import { updateDirectoriesSize } from "./fileController.js";
import { restoreS3Object, softDeleteS3Object,deleteS3Object } from "../services/awsService.js";

export const getDirectory = async (req, res) => {
  const user = req.user;
  const _id = req.params.id || user.rootDirId.toString();
  const directoryData = await Directory.findOne({
    _id,
    userId: req.user._id,
  }).lean();
  if (!directoryData) {
    return res
      .status(404)
      .json({ error: "Directory not found or you do not have access to it!" });
  }

  const files = await File.find({ parentDirId: directoryData._id, deletedAt: null }).lean();
  const directories = await Directory.find({ parentDirId: _id, deletedAt: null }).lean();
  return res.status(200).json({
    ...directoryData,
    files: files.map((dir) => ({ ...dir, id: dir._id })),
    directories: directories.map((dir) => ({ ...dir, id: dir._id })),
  });
};

export const createDirectory = async (req, res, next) => {
  const user = req.user;

  const parentDirId = req.params.parentDirId || user.rootDirId.toString();
  const dirname=req.body.dirname || "new Folder"
  try {
    const parentDir = await Directory.findOne({
      _id: parentDirId,
    }).lean();

    if (!parentDir)
      return res
        .status(404)
        .json({ message: "Parent Directory Does not exist!" });
  const newDirectory = await Directory.create({
      name: dirname,
      parentDirId,
      userId: user._id,
    });

    const data=newDirectory.toObject();
    return res.status(201).json({ message: "Directory Created!" });
  } catch (err) {
    if (err.code === 121) {
      res
        .status(400)
        .json({ error: "Invalid input, please enter valid details" });
    } else {
      next(err);
    }
  }
};

export const renameDirectory = async (req, res, next) => {
  const user = req.user;
  const { id } = req.params;
  const { newDirName } = req.body;
  try {
    await Directory.findOneAndUpdate(
      {
        _id: id,
        userId: user._id,
      },
      { name: newDirName }
    );
    res.status(200).json({ message: "Directory Renamed!" });
  } catch (err) {
    next(err);
  }
};

 async function getDirectoryContents(id) {
      let files = await File.find({ parentDirId: id })
        .select("_id extension deletedAt").lean();
      let directories = await Directory.find({ parentDirId: id })
        .select("_id")
        .lean();

      for (const { _id } of directories) {
        const { files: childFiles, directories: childDirectories } =
          await getDirectoryContents(_id);

        files = [...files, ...childFiles];
        directories = [...directories, ...childDirectories];
      }

      return { files, directories };
    }

export const softDeleteDirectory = async (req, res, next) => {
  // soft delete ho raha h
  const { id } = req.params;

  try {
    const directoryData = await Directory.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!directoryData) {
      return res.status(404).json({ error: "Directory not found!" });
    }

   

    const { files, directories } = await getDirectoryContents(id);


    for (const { _id, extension, deletedAt } of files) {
      if(deletedAt==null){
       await softDeleteS3Object({ Key: `${_id.toString()}${extension}` });
      }
    } 

    await File.updateMany(
      { _id: { $in: files.map(({ _id }) => _id) } },
      { deletedAt: new Date(), parentInRecycleBin: true },

    );


    await Directory.updateMany(
      { _id: { $in: [...directories.map(({ _id }) => _id)] } },
      { deletedAt: new Date(), isparentInRecycleBin: true }
    );
     directoryData.deletedAt = new Date();   
     await directoryData.save();
    await updateDirectoriesSize(directoryData.parentDirId, -directoryData.size);
    return res.json({ message: "Files deleted successfully" });
  } catch (err) {
    return next(err);
  }
  
};

export const restoreDirectory = async (req, res, next) => {
  const { directoryId: id } = req.params;

  try {
    const directory = await Directory.findOne({
      _id: id,
      userId: req.user._id,
      deletedAt: { $ne: null },
    });

    if (!directory) {
      return res.status(404).json({ error: "Directory not found!" });
    }

    // ✅ Parent directory must exist & not be deleted
    if (directory.parentDirId) {
      const parentDir = await Directory.findOne({
        _id: directory.parentDirId,
        userId: req.user._id,
        deletedAt: null,
      }).lean();

      if (!parentDir) {
        return res.status(400).json({
          error: "Cannot restore directory as parent directory is deleted.",
        });
      }
    }

    const { files, directories } = await getDirectoryContents(id);

    // ✅ 1. Restore S3 objects FIRST
    await Promise.all(
      files.map(file =>
        restoreS3Object({
          Key: `${file._id}${file.extension}`,
        })
      )
    );

    // ✅ 2. Bulk DB restore
    if (files.length) {
      await File.updateMany(
        { _id: { $in: files.map(f => f._id) } },
        { $set: { deletedAt: null, parentInRecycleBin: false } }
      );
    }

    if (directories.length) {
      await Directory.updateMany(
        { _id: { $in: directories.map(d => d._id) } },
        { $set: { deletedAt: null } }
      );
    }

    // Restore root directory
    await Directory.updateOne(
      { _id: id },
      { $set: { deletedAt: null } }
    );

    // ✅ 3. Update parent size
    await updateDirectoriesSize(directory.parentDirId, directory.size);

    return res
      .status(200)
      .json({ message: "Directory restored successfully" });
  } catch (err) {
    next(err);
  }
};


export const deleteDirectory = async (req, res, next) => {
  const { id } = req.params;
  const directory = await Directory.findOne({
    _id: id,
    userId: req.user._id,
  });
  if (!directory) {
    return res.status(404).json({ error: "Directory not found!" });
  }
  try {
    const { files, directories } = await getDirectoryContents(id);
    for (const { _id, extension } of files) {
      await deleteS3Object({ Key: `${_id}${extension}` });
    }
    await File.deleteMany({ _id: { $in: files.map(({ _id }) => _id) } });
    await Directory.deleteMany({
      _id: { $in: [...directories.map(({ _id }) => _id)] },
    });
    await directory.deleteOne();
    return res.status(200).json({ message: "Directory Deleted Successfully" });
  } catch (err) {
    next(err);
  }
};







  
