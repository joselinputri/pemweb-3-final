import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TransactionItem {
  book_id: string;
  quantity: number;
}

interface GenreCount {
  name: string;
  total: bigint;
}

export const createTransaction = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user_id, items } = req.body as {
      user_id: string;
      items: TransactionItem[];
    };

    if (!user_id) {
      res.status(400).json({ success: false, message: "user_id is required" });
      return;
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "items cannot be empty" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: user_id } });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    let totalPrice = 0;
    let totalQuantity = 0;
    const bookOperations = [];
    const orderItemsData = [];

    for (const item of items) {
      if (!item.book_id || item.quantity <= 0) {
        res.status(400).json({
          success: false,
          message: "Each item must have valid book_id and quantity > 0",
        });
        return;
      }

      const book = await prisma.book.findFirst({
        where: { id: item.book_id, deleted_at: null },
      });

      if (!book) {
        res.status(404).json({
          success: false,
          message: `Book with id ${item.book_id} not found`,
        });
        return;
      }
      if (book.stock_quantity < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for "${book.title}". Available: ${book.stock_quantity}`,
        });
        return;
      }

      totalPrice += book.price * item.quantity;
      totalQuantity += item.quantity;

      orderItemsData.push({
        book_id: item.book_id,
        quantity: item.quantity,
      });

      bookOperations.push(
        prisma.book.update({
          where: { id: item.book_id },
          data: { stock_quantity: { decrement: item.quantity } },
        })
      );
    }

    const [createdOrder] = await prisma.$transaction([
      prisma.order.create({
        data: {
          user_id: user.id,
          totalPrice: totalPrice,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          user: {
            select: { id: true, username: true, email: true },
          },
          items: {
            include: { book: { include: { genre: true } } },
          },
        },
      }),
      ...bookOperations,
    ]);

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: {
        transaction_id: createdOrder.id,
        user: createdOrder.user,
        total_quantity: totalQuantity,
        total_price: createdOrder.totalPrice,
        items: createdOrder.items.map((item) => ({
          id: item.id,
          book: {
            id: item.book.id,
            title: item.book.title,
            writer: item.book.writer,
            price: item.book.price,
            genre: item.book.genre.name,
          },
          quantity: item.quantity,
          subtotal: item.book.price * item.quantity,
        })),
        created_at: createdOrder.created_at,
      },
    });
  } catch (error: unknown) {
    console.error("❌ Create transaction error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to create transaction",
      error: errorMessage,
    });
  }
};

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
            email: true,
          },
        },
        items: {
          include: {
            book: {
              include: {
                genre: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Get all transactions successfully",
      count: transactions.length,
      data: transactions.map((transaction) => ({
        id: transaction.id,
        user: transaction.user,
        total_price: transaction.totalPrice,
        total_items: transaction.items.length,
        items: transaction.items.map((item) => ({
          book_title: item.book.title,
          genre: item.book.genre.name,
          quantity: item.quantity,
          price: item.book.price,
        })),
        created_at: transaction.created_at,
      })),
    });
  } catch (error: unknown) {
    console.error("❌ Get all transactions error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to get transactions",
      error: errorMessage,
    });
  }
};

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
            email: true,
          },
        },
        items: {
          include: {
            book: {
              include: {
                genre: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: "Transaction not found",
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
        items: transaction.items.map((item) => ({
          id: item.id,
          book: {
            id: item.book.id,
            title: item.book.title,
            writer: item.book.writer,
            publisher: item.book.publisher,
            price: item.book.price,
            genre: item.book.genre.name,
          },
          quantity: item.quantity,
          subtotal: item.book.price * item.quantity,
        })),
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
    });
  } catch (error: unknown) {
    console.error("❌ Get transaction by ID error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to get transaction detail",
      error: errorMessage,
    });
  }
};

export const getTransactionStatistics = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const totalTransactions = await prisma.order.count();

    const avgResult = await prisma.order.aggregate({
      _avg: {
        totalPrice: true,
      },
    });

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
      },
    });
  } catch (error: unknown) {
    console.error("❌ Get transaction statistics error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      success: false,
      message: "Failed to get transaction statistics",
      error: errorMessage,
    });
  }
};
