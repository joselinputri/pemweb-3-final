import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ Interface for transaction items
interface TransactionItem {
  book_id: string;
  quantity: number;
}

// ✅ Interface for SQL query result
interface GenreCount {
  name: string;
  total: bigint;
}

// ========================================
// ✅ CREATE TRANSACTION
// ========================================
export const createTransaction = async (
  req: Request, 
  res: Response
): Promise<void> => {
  try {
    const { user_id, items } = req.body as {
      user_id: string;
      items: TransactionItem[];
    };

    // Validasi required fields
    if (!user_id) {
      res.status(400).json({
        success: false,
        message: "user_id is required"
      });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: "items cannot be empty and must be an array"
      });
      return;
    }

    // Validasi user exists
    const user = await prisma.user.findUnique({
      where: { id: user_id }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    let totalQuantity = 0;
    let totalPrice = 0;

    // Validasi semua books dan stock
    for (const item of items) {
      if (!item.book_id || !item.quantity) {
        res.status(400).json({
          success: false,
          message: "Each item must have book_id and quantity"
        });
        return;
      }

      if (item.quantity <= 0) {
        res.status(400).json({
          success: false,
          message: "Quantity must be greater than 0"
        });
        return;
      }

      const book = await prisma.book.findFirst({
        where: { 
          id: item.book_id,
          deleted_at: null
        }
      });

      if (!book) {
        res.status(404).json({
          success: false,
          message: `Book with id ${item.book_id} not found`
        });
        return;
      }

      if (book.stock_quantity < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for book "${book.title}". Available: ${book.stock_quantity}, Requested: ${item.quantity}`
        });
        return;
      }
    }

    // Create order dengan totalPrice awal 0
    const order = await prisma.order.create({
      data: { 
        user_id,
        totalPrice: 0
      },
    });

    // Create order items dan hitung total
    for (const item of items) {
      const book = await prisma.book.findUnique({ 
        where: { id: item.book_id } 
      });

      if (!book) continue;

      const subtotal = book.price * item.quantity;
      totalQuantity += item.quantity;
      totalPrice += subtotal;

      // Create order item
      await prisma.orderItem.create({
        data: {
          order_id: order.id,
          book_id: book.id,
          quantity: item.quantity,
        },
      });

      // Update stock buku
      await prisma.book.update({
        where: { id: book.id },
        data: { 
          stock_quantity: { 
            decrement: item.quantity 
          } 
        },
      });
    }

    // Update total price order
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { totalPrice: totalPrice },
      include: {
        user: {
          select: { 
            id: true, 
            username: true, 
            email: true 
          }
        },
        items: {
          include: { 
            book: {
              include: {
                genre: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: {
        transaction_id: updatedOrder.id,
        user: updatedOrder.user,
        total_quantity: totalQuantity,
        total_price: totalPrice,
        items: updatedOrder.items.map(item => ({
          id: item.id,
          book: {
            id: item.book.id,
            title: item.book.title,
            writer: item.book.writer,
            price: item.book.price,
            genre: item.book.genre.name
          },
          quantity: item.quantity,
          subtotal: item.book.price * item.quantity
        })),
        created_at: updatedOrder.created_at
      }
    });

  } catch (error: unknown) {
    console.error("❌ Create transaction error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to create transaction",
      error: errorMessage
    });
  }
};

// ========================================
// ✅ GET ALL TRANSACTIONS
// ========================================
export const getAllTransactions = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const transactions = await prisma.order.findMany({
      include: {
        user: { 
          select: { 
            id: true, 
            username: true, 
            email: true 
          } 
        },
        items: { 
          include: { 
            book: {
              include: { 
                genre: true 
              }
            } 
          } 
        },
      },
      orderBy: { created_at: 'desc' }
    });

    res.status(200).json({
      success: true,
      message: "Get all transactions successfully",
      count: transactions.length,
      data: transactions.map(transaction => ({
        id: transaction.id,
        user: transaction.user,
        total_price: transaction.totalPrice,
        total_items: transaction.items.length,
        items: transaction.items.map(item => ({
          book_title: item.book.title,
          genre: item.book.genre.name,
          quantity: item.quantity,
          price: item.book.price
        })),
        created_at: transaction.created_at
      }))
    });

  } catch (error: unknown) {
    console.error("❌ Get all transactions error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to get transactions",
      error: errorMessage
    });
  }
};

// ========================================
// ✅ GET TRANSACTION BY ID
// ========================================
export const getTransactionById = async (
  req: Request, 
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const transaction = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { 
          select: { 
            id: true, 
            username: true, 
            email: true 
          } 
        },
        items: { 
          include: { 
            book: {
              include: { 
                genre: true 
              }
            }
          } 
        },
      },
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Get transaction detail successfully",
      data: {
        id: transaction.id,
        user: transaction.user,
        total_price: transaction.totalPrice,
        items: transaction.items.map(item => ({
          id: item.id,
          book: {
            id: item.book.id,
            title: item.book.title,
            writer: item.book.writer,
            publisher: item.book.publisher,
            price: item.book.price,
            genre: item.book.genre.name
          },
          quantity: item.quantity,
          subtotal: item.book.price * item.quantity
        })),
        created_at: transaction.created_at,
        updated_at: transaction.updated_at
      }
    });

  } catch (error: unknown) {
    console.error("❌ Get transaction by ID error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to get transaction detail",
      error: errorMessage
    });
  }
};

// ========================================
// ✅ GET TRANSACTION STATISTICS
// ========================================
export const getTransactionStatistics = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    // Total transactions
    const totalTransactions = await prisma.order.count();

    // Average transaction value
    const avgResult = await prisma.order.aggregate({
      _avg: {
        totalPrice: true,
      },
    });

    // Most popular genre
    const topGenreResult = await prisma.$queryRaw<GenreCount[]>`
      SELECT g.name, COUNT(oi.id)::bigint as total
      FROM "order_items" oi
      JOIN "books" b ON b.id = oi."book_id"
      JOIN "genres" g ON g.id = b."genre_id"
      WHERE b."deleted_at" IS NULL AND g."deleted_at" IS NULL
      GROUP BY g.name
      ORDER BY total DESC
      LIMIT 1
    `;

    // Least popular genre
    const leastGenreResult = await prisma.$queryRaw<GenreCount[]>`
      SELECT g.name, COUNT(oi.id)::bigint as total
      FROM "order_items" oi
      JOIN "books" b ON b.id = oi."book_id"
      JOIN "genres" g ON g.id = b."genre_id"
      WHERE b."deleted_at" IS NULL AND g."deleted_at" IS NULL
      GROUP BY g.name
      ORDER BY total ASC
      LIMIT 1
    `;

    res.status(200).json({
      success: true,
      message: "Get transaction statistics successfully",
      data: {
        total_transactions: totalTransactions,
        average_transaction_value: avgResult._avg.totalPrice || 0,
        most_popular_genre: topGenreResult[0]?.name || null,
        least_popular_genre: leastGenreResult[0]?.name || null,
      }
    });

  } catch (error: unknown) {
    console.error("❌ Get transaction statistics error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to get transaction statistics",
      error: errorMessage
    });
  }
};