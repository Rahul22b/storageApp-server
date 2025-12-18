import express from "express";
import File from "../models/fileModel.js";
import Directory from "../models/directoryModel.js";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  deleteFile,
  getFile,
  createuploadSignedUrl,
  renameFile,
  checkfileupload,
  restoreFile,
  softDeleteFile
  
} from "../controllers/fileController.js";
const router = express.Router();
router.param("parentDirId", validateIdMiddleware);
router.param("id", validateIdMiddleware);

router.get('/recycledFile/:parentDirId?', async (req, res) => {
  try {
    const userId = req.user._id;
    const rootDirId = req.user.rootDirId.toString();
    const parentDirId = req.params.parentDirId || rootDirId;

    const isRootRecycle = parentDirId === rootDirId;

    // 🔥 Build file query dynamically
    const fileQuery = {
      userId,
      deletedAt: { $ne: null },
      ...(isRootRecycle
        ? { parentInRecycleBin: false } // orphan files at root
        : { parentDirId })
    };

    const directoryQuery = {
      userId,
      deletedAt: { $ne: null },
      ...(isRootRecycle
        ? { isparentInRecycleBin: false } // directories marked as in recycle bin at root
        : { parentDirId })
    };


    const [files, directories] = await Promise.all([
      File.find(fileQuery).lean(),
      Directory.find(directoryQuery).lean()
    ]);

    res.json({ files, directories });
  } catch (error) {
    console.error("Error fetching recycled files:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.get("/:id", getFile); 

router.patch("/:id", renameFile);

router.delete("/:id", deleteFile);

router.post('/initiate/:parentDirId?',createuploadSignedUrl);

router.post('/upload/check',checkfileupload);

router.delete('/softDelete/:id',softDeleteFile);
router.patch('/restore/:id',restoreFile);



export default router;
