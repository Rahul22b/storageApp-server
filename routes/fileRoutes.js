import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  deleteFile,
  getFile,
  createuploadSignedUrl,
  renameFile,
  checkfileupload,
  
} from "../controllers/fileController.js";
import File from "../models/fileModel.js";

const router = express.Router();

router.param("parentDirId", validateIdMiddleware);
router.param("id", validateIdMiddleware);

// router.post("/:parentDirId?", uploadFile);

router.get("/:id", getFile); 

router.patch("/:id", renameFile);

router.delete("/:id", deleteFile);

router.post('/initiate/:parentDirId?',createuploadSignedUrl);

router.post('/upload/check',checkfileupload)

export default router;
