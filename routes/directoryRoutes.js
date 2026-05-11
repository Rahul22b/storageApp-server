import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";

import {
  createDirectory,
  deleteDirectory,
  getDirectory,
  renameDirectory,
  restoreDirectory,
  softDeleteDirectory,
  

} from "../controllers/directoryController.js";

const router = express.Router();

router.param("parentDirId", validateIdMiddleware);
router.param("id", validateIdMiddleware);

router.get("/:id?", getDirectory);

router.post("/:parentDirId?", createDirectory);

router.patch("/:id", renameDirectory);

router.delete("/:id", softDeleteDirectory);

router.delete("/delete/:id", deleteDirectory);

router.patch('/restore/:directoryId', restoreDirectory);

export default router;
