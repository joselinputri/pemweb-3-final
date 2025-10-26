import { Router } from "express";
import {
  createBook,
  getBooks,
  getBookDetail,
  updateBook,
  deleteBook,
} from "../controllers/book.controller";

const router = Router();

router.post("/", createBook);
router.get("/", getBooks);
router.get("/:book_id", getBookDetail);
router.patch("/:book_id", updateBook);
router.delete("/:book_id", deleteBook);

export default router;
