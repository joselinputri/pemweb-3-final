import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ CREATE
export const createGenre = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      res.status(400).json({ 
        success: false,
        message: "Nama genre wajib diisi" 
      });
      return;
    }

    // ✅ Check if genre exists (only non-deleted)
    const exist = await prisma.genre.findFirst({ 
      where: { 
        name: name.trim(),
        deleted_at: null
      } 
    });
    
    if (exist) {
      res.status(409).json({ 
        success: false,
        message: "Genre sudah ada" 
      });
      return;
    }

    const genre = await prisma.genre.create({ 
      data: { name: name.trim() } 
    });

    res.status(201).json({ 
      success: true,
      message: "Genre berhasil dibuat", 
      data: genre 
    });
  } catch (err: any) {
    console.error("Create genre error:", err);
    res.status(500).json({ 
      success: false,
      message: "Gagal membuat genre", 
      error: err.message 
    });
  }
};

// ✅ READ (GET ALL) - Only non-deleted
export const getGenres = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const genres = await prisma.genre.findMany({
      where: { deleted_at: null },
      include: { 
        books: {
          where: { deleted_at: null }
        },
        _count: {
          select: { books: { where: { deleted_at: null } } }
        }
      },
      orderBy: { name: "asc" },
    });

    res.json({ 
      success: true,
      message: "Daftar genre berhasil diambil",
      count: genres.length,
      data: genres.map(genre => ({
        ...genre,
        total_books: genre._count.books
      }))
    });
  } catch (err: any) {
    console.error("Get genres error:", err);
    res.status(500).json({ 
      success: false,
      message: "Gagal mengambil daftar genre", 
      error: err.message 
    });
  }
};

// ✅ GET GENRE BY ID
export const getGenreById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { genre_id } = req.params;

    const genre = await prisma.genre.findFirst({
      where: { 
        id: genre_id,
        deleted_at: null
      },
      include: { 
        books: {
          where: { deleted_at: null }
        },
        _count: {
          select: { books: { where: { deleted_at: null } } }
        }
      }
    });

    if (!genre) {
      res.status(404).json({ 
        success: false,
        message: "Genre tidak ditemukan" 
      });
      return;
    }

    res.json({ 
      success: true,
      message: "Detail genre berhasil diambil",
      data: {
        ...genre,
        total_books: genre._count.books
      }
    });
  } catch (err: any) {
    console.error("Get genre by ID error:", err);
    res.status(500).json({ 
      success: false,
      message: "Gagal mengambil detail genre", 
      error: err.message 
    });
  }
};

// ✅ UPDATE
export const updateGenre = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { genre_id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === "") {
      res.status(400).json({ 
        success: false,
        message: "Nama genre wajib diisi" 
      });
      return;
    }

    // ✅ Check if genre exists and not deleted
    const genre = await prisma.genre.findFirst({
      where: { 
        id: genre_id,
        deleted_at: null
      }
    });

    if (!genre) {
      res.status(404).json({ 
        success: false,
        message: "Genre tidak ditemukan" 
      });
      return;
    }

    // ✅ Check if new name already exists
    const nameExists = await prisma.genre.findFirst({
      where: {
        name: name.trim(),
        deleted_at: null,
        NOT: { id: genre_id }
      }
    });

    if (nameExists) {
      res.status(409).json({
        success: false,
        message: "Nama genre sudah digunakan"
      });
      return;
    }

    const updated = await prisma.genre.update({
      where: { id: genre_id },
      data: { name: name.trim() },
      include: {
        _count: {
          select: { books: { where: { deleted_at: null } } }
        }
      }
    });

    res.json({ 
      success: true,
      message: "Genre berhasil diupdate", 
      data: {
        ...updated,
        total_books: updated._count.books
      }
    });
  } catch (err: any) {
    console.error("Update genre error:", err);
    
    if (err.code === "P2025") {
      res.status(404).json({ 
        success: false,
        message: "Genre tidak ditemukan" 
      });
      return;
    }
    
    res.status(500).json({ 
      success: false,
      message: "Gagal update genre", 
      error: err.message 
    });
  }
};

// ✅ DELETE (Soft Delete) - IMPROVED
export const deleteGenre = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { genre_id } = req.params;

    // ✅ 1. Cek apakah genre exists dan belum dihapus
    const genre = await prisma.genre.findFirst({
      where: { 
        id: genre_id,
        deleted_at: null
      },
      include: {
        books: {
          where: { deleted_at: null }
        }
      }
    });

    if (!genre) {
      res.status(404).json({ 
        success: false,
        message: "Genre tidak ditemukan atau sudah dihapus" 
      });
      return;
    }

    // ✅ 2. Check if genre has active books
    if (genre.books.length > 0) {
      res.status(400).json({
        success: false,
        message: `Tidak dapat menghapus genre. Masih ada ${genre.books.length} buku aktif dengan genre ini`,
        data: {
          genre_name: genre.name,
          active_books_count: genre.books.length,
          books: genre.books.map(book => ({
            id: book.id,
            title: book.title,
            writer: book.writer
          }))
        }
      });
      return;
    }

    // ✅ 3. Soft delete
    const deletedGenre = await prisma.genre.update({
      where: { id: genre_id },
      data: { deleted_at: new Date() }
    });

    // ✅ 4. Response dengan info lengkap
    res.json({ 
      success: true,
      message: "Genre berhasil dihapus",
      data: {
        id: deletedGenre.id,
        name: deletedGenre.name,
        deleted_at: deletedGenre.deleted_at
      }
    });

  } catch (err: any) {
    console.error("Delete genre error:", err);
    
    if (err.code === "P2025") {
      res.status(404).json({ 
        success: false,
        message: "Genre tidak ditemukan" 
      });
      return;
    }
    
    res.status(500).json({ 
      success: false,
      message: "Gagal hapus genre", 
      error: err.message 
    });
  }
};