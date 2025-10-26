import { Router } from "express";
import {
  createGenre,
  getGenres,
  getGenreById,  // ✅ Add this import
  updateGenre,
  deleteGenre,
} from "../controllers/genre.controller";

const router = Router();

router.post("/", createGenre);
router.get("/", getGenres);
router.get("/:genre_id", getGenreById);  // ✅ Add this route
router.patch("/:genre_id", updateGenre);
router.delete("/:genre_id", deleteGenre);

export default router;