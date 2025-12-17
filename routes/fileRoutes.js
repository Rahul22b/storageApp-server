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

router.get('/recycledFile',async (req,res)=>{
  console.log(req.user._id);
  const id=req.user._id;
  try {
const recycledFiles = await File.find({ userId: req.user._id, deletedAt: { $ne: null } }).lean();
const recycledDirectory = await Directory.find({ userId: req.user._id, deletedAt: { $ne: null } }).lean();
    res.json({ files: recycledFiles, directories: recycledDirectory });
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
