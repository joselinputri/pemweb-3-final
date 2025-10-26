import { Request, Response } from "express";
import prisma from "../config/database";
import { HttpResponse } from "../../utils/response";

export const createTransaction = async (req: Request, res: Response) => {
  const { user_id, items } = req.body;
  try {
    if (!items || items.length === 0)
      return HttpResponse.badRequest(res, "Transaction items cannot be empty");

    let totalQuantity = 0;
    let totalPrice = 0;

    const order = await prisma.order.create({
      data: { user_id },
    });

    for (const item of items) {
      const book = await prisma.book.findUnique({ where: { id: item.book_id } });
      if (!book) continue;

      const subtotal = book.price * item.quantity;
      totalQuantity += item.quantity;
      totalPrice += subtotal;

      await prisma.orderItem.create({
        data: {
          order_id: order.id,
          book_id: book.id,
          quantity: item.quantity,
        },
      });

      await prisma.book.update({
        where: { id: book.id },
        data: { stock_quantity: { decrement: item.quantity } },
      });
    }

    await prisma.order.updateUnchecked({
      where: { id: order.id },
      data: { totalPrice: totalPrice },
    });

    return HttpResponse.created(res, "Transaction created successfully", {
      transaction_id: order.id,
      total_quantity: totalQuantity,
      total_price: totalPrice,
    });
  } catch {
    return HttpResponse.serverError(res, "Failed to create transaction");
  }
};

export const getTransactionStatistics = async (req: Request, res: Response) => {
  try {
    const totalTransactions = await prisma.order.count();
    const avg = await prisma.order.aggregate({
      _avg: {
        totalPrice: true,
      },
    });

    const topGenre = await prisma.$queryRawUnsafe(`
      SELECT g.name, COUNT(oi.id) as total
      FROM "order_items" oi
      JOIN "books" b ON b.id = oi."book_id"
      JOIN "genres" g ON g.id = b."genre_id"
      GROUP BY g.name
      ORDER BY total DESC
      LIMIT 1;
    `);

    const leastGenre = await prisma.$queryRawUnsafe(`
      SELECT g.name, COUNT(oi.id) as total
      FROM "order_items" oi
      JOIN "books" b ON b.id = oi."book_id"
      JOIN "genres" g ON g.id = b."genre_id"
      GROUP BY g.name
      ORDER BY total ASC
      LIMIT 1;
    `);

    return HttpResponse.ok(res, "Get transaction statistics successfully", {
      total_transaction: totalTransactions,
      average_transaction: (avg as any)._avg.totalPrice || 0,
      most_popular_genre: (topGenre as any)[0]?.name || null,
      least_popular_genre: (leastGenre as any)[0]?.name || null,
    });
  } catch {
    return HttpResponse.serverError(res, "Failed to get transaction statistics");
  }
};

export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.order.findMany({
      include: {
        user: { select: { id: true, username: true, email: true } },
        items: { include: { book: true } },
      },
    });
    return HttpResponse.ok(res, "Get all transactions successfully", transactions);
  } catch {
    return HttpResponse.serverError(res, "Failed to get transactions");
  }
};

export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const transaction = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, username: true, email: true } },
        items: { include: { book: true } },
      },
    });
    if (!transaction) return HttpResponse.notFound(res, "Transaction not found");
    return HttpResponse.ok(res, "Get transaction detail successfully", transaction);
  } catch {
    return HttpResponse.serverError(res, "Failed to get transaction detail");
  }
};
