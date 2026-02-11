import { Router } from "express";
import { createUser, listUsers, updateUser, deleteUser, resetUserPassword, updateUserStatus } from "../controllers/usersController.js";
import { requireRoles } from "../middleware/auth.js";

const router = Router();

router.get("/", requireRoles("compras_admin"), listUsers);
router.post("/", requireRoles("compras_admin"), createUser);
router.put("/:id", requireRoles("compras_admin"), updateUser);
router.delete("/:id", requireRoles("compras_admin"), deleteUser);
router.put("/:id/reset-password", requireRoles("compras_admin"), resetUserPassword);
router.put("/:id/status", requireRoles("compras_admin"), updateUserStatus);

export default router;
