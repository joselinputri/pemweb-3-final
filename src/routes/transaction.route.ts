import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  createTransaction, getAllTransactions, getTransactionById, getTransactionStatistics,
} from "../controllers/transaction.controller";

const router = Router();
router.use(authMiddleware);

router.post("/", createTransaction);
router.get("/", getAllTransactions);
router.get("/:id", getTransactionById);
router.get("/statistics", getTransactionStatistics);

export default router;
