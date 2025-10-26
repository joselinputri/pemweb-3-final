// ============================================
// FILE: src/controllers/book.controller.ts
// ============================================

import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ CREATE
export const createBook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      title,
      writer,
      publisher,
      publication_year,
      description,
      price,
      stock_quantity,
      genre_id,
    } = req.body as any;

    if (!title || !writer || !publisher || !price || !stock_quantity || !genre_id) {
      res.status(400).json({ 
        success: false,
        message: "Semua field wajib diisi (title, writer, publisher, price, stock_quantity, genre_id)" 
      });
      return;
    }

    // ✅ Trim dan validate genre_id
    const cleanGenreId = genre_id.trim();
    const genre = await prisma.genre.findFirst({
      where: { 
        id: cleanGenreId,
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

    // ✅ Check existing non-deleted book
    const exist = await prisma.book.findFirst({ 
      where: { 
        title: title.trim(),
        deleted_at: null
      } 
    });
    
    if (exist) {
      res.status(409).json({ 
        success: false,
        message: "Judul buku sudah ada" 
      });
      return;
    }

    const book = await prisma.book.create({
      data: {
        title: title.trim(),
        writer: writer.trim(),
        publisher: publisher.trim(),
        publication_year: publication_year ? Number(publication_year) : null,
        description: description?.trim(),
        price: Number(price),
        stock_quantity: Number(stock_quantity),
        genre_id: cleanGenreId,
      },
      include: { genre: true },
    });

    res.status(201).json({ 
      success: true,
      message: "Buku berhasil dibuat", 
      data: book 
    });
  } catch (err: any) {
    console.error("Create book error:", err);
    res.status(500).json({ 
      success: false,
      message: "Gagal membuat buku", 
      error: err.message 
    });
  }
};

// ✅ READ (GET ALL) - Only non-deleted
export const getBooks = async (req: Request, res: Response): Promise<void> => {
  try {
    const title = req.query.title as string | undefined;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where: { 
          deleted_at: null,
          ...(title && { title: { contains: title, mode: 'insensitive' } })
        },
        skip,
        take: limit,
        include: { genre: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.book.count({
        where: { 
          deleted_at: null,
          ...(title && { title: { contains: title, mode: 'insensitive' } })
        }
      })
    ]);

    res.json({ 
      success: true,
      message: "Daftar buku berhasil diambil",
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      },
      data: books 
    });
  } catch (err: any) {
    console.error("Get books error:", err);
    res.status(500).json({ 
      success: false,
      message: "Gagal mengambil daftar buku", 
      error: err.message 
    });
  }
};

// ✅ READ (GET DETAIL)
export const getBookDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { book_id } = req.params;
    
    // ✅ TRIM book_id untuk menghindari whitespace/newline
    const cleanBookId = book_id.trim();

    const book = await prisma.book.findFirst({
      where: { 
        id: cleanBookId,
        deleted_at: null
      },
      include: { genre: true },
    });

    if (!book) {
      res.status(404).json({ 
        success: false,
        message: "Buku tidak ditemukan" 
      });
      return;
    }

    res.json({ 
      success: true,
      message: "Detail buku berhasil diambil",
      data: book 
    });
  } catch (err: any) {
    console.error("Get book detail error:", err);
    res.status(500).json({ 
      success: false,
      message: "Gagal mengambil detail buku", 
      error: err.message 
    });
  }
};

// ✅ UPDATE
export const updateBook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { book_id } = req.params;
    const data = req.body;

    // ✅ TRIM book_id untuk menghindari whitespace/newline
    const cleanBookId = book_id.trim();

    // ✅ Check if book exists and not deleted
    const book = await prisma.book.findFirst({
      where: { 
        id: cleanBookId,
        deleted_at: null
      }
    });

    if (!book) {
      res.status(404).json({ 
        success: false,
        message: "Buku tidak ditemukan" 
      });
      return;
    }

    // ✅ Validate genre_id if provided
    if (data.genre_id) {
      const cleanGenreId = data.genre_id.trim();
      const genre = await prisma.genre.findFirst({
        where: { 
          id: cleanGenreId,
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
      data.genre_id = cleanGenreId;
    }

    // ✅ Prepare update data (trim strings)
    const updateData: any = {};
    
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.writer !== undefined) updateData.writer = data.writer.trim();
    if (data.publisher !== undefined) updateData.publisher = data.publisher.trim();
    if (data.publication_year !== undefined) updateData.publication_year = parseInt(data.publication_year);
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.price !== undefined) updateData.price = parseFloat(data.price);
    if (data.stock_quantity !== undefined) updateData.stock_quantity = parseInt(data.stock_quantity);
    if (data.genre_id !== undefined) updateData.genre_id = data.genre_id;

    // ✅ Validate fields
    if (updateData.title && updateData.title === "") {
      res.status(400).json({
        success: false,
        message: "Judul buku tidak boleh kosong"
      });
      return;
    }

    if (updateData.price !== undefined && updateData.price < 0) {
      res.status(400).json({
        success: false,
        message: "Harga tidak boleh negatif"
      });
      return;
    }

    if (updateData.stock_quantity !== undefined && updateData.stock_quantity < 0) {
      res.status(400).json({
        success: false,
        message: "Stok tidak boleh negatif"
      });
      return;
    }

    const updated = await prisma.book.update({ 
      where: { id: cleanBookId }, 
      data: updateData,
      include: { genre: true }
    });

    res.json({ 
      success: true,
      message: "Buku berhasil diupdate", 
      data: updated 
    });
  } catch (err: any) {
    console.error("Update book error:", err);
    if (err.code === "P2025") {
      res.status(404).json({ 
        success: false,
        message: "Buku tidak ditemukan" 
      });
      return;
    }
    res.status(500).json({ 
      success: false,
      message: "Gagal update buku", 
      error: err.message 
    });
  }
};

// ✅ DELETE (Soft Delete) - IMPROVED
export const deleteBook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { book_id } = req.params;

    // ✅ TRIM book_id untuk menghindari whitespace/newline
    const cleanBookId = book_id.trim();

    // ✅ 1. Cek apakah buku exists dan belum dihapus
    const book = await prisma.book.findFirst({
      where: { 
        id: cleanBookId,
        deleted_at: null
      },
      include: { genre: true }
    });

    if (!book) {
      res.status(404).json({ 
        success: false,
        message: "Buku tidak ditemukan atau sudah dihapus" 
      });
      return;
    }

    // ✅ 2. Soft delete
    const deletedBook = await prisma.book.update({
      where: { id: cleanBookId },
      data: { deleted_at: new Date() },
      include: { genre: true }
    });

    // ✅ 3. Response dengan info lengkap
    res.json({ 
      success: true,
      message: "Buku berhasil dihapus",
      data: {
        id: deletedBook.id,
        title: deletedBook.title,
        writer: deletedBook.writer,
        publisher: deletedBook.publisher,
        genre: deletedBook.genre.name,
        deleted_at: deletedBook.deleted_at
      }
    });

  } catch (err: any) {
    console.error("Delete book error:", err);
    
    if (err.code === "P2025") {
      res.status(404).json({ 
        success: false,
        message: "Buku tidak ditemukan" 
      });
      return;
    }
    
    res.status(500).json({ 
      success: false,
      message: "Gagal hapus buku", 
      error: err.message 
    });
  }
};