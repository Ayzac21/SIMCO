import { Router } from "express";
import { createUser, listUsers, updateUser, deleteUser, resetUserPassword, updateUserStatus } from "../controllers/usersController.js";

const router = Router();

router.get("/", listUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.put("/:id/reset-password", resetUserPassword);
router.put("/:id/status", updateUserStatus);

export default router;
