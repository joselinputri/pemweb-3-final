import { Request, Response, NextFunction } from "express";

/**
 * Global error handler middleware
 * Menangani semua error agar response tetap konsisten
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("❌ ERROR:", err);

  // Tentukan status code (default 500)
  const status = err.status || 500;
  const message =
    err.message || "Internal Server Error";

  // Kembalikan response JSON seragam
  res.status(status).json({
    success: false,
    message,
  });
};
