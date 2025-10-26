import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware";
import {
  createTransaction, 
  getAllTransactions, 
  getTransactionById, 
  getTransactionStatistics,
} from "../controllers/transaction.controller";

const router = Router();



router.get("/statistics", authMiddleware, getTransactionStatistics);
router.post("/", authMiddleware, createTransaction);
router.get("/", authMiddleware, getAllTransactions);
router.get("/:id", authMiddleware, getTransactionById);

export default router;