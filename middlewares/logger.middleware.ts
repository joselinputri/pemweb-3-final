import { Request, Response, NextFunction } from "express";

// Simple request logger middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Event listener to log after response sent
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logMessage = `[${new Date().toLocaleString()}] ${req.method} ${
      req.originalUrl
    } ${res.statusCode} - ${duration}ms`;

    // Warna agar lebih enak dibaca
    if (res.statusCode >= 500) console.log("\x1b[31m%s\x1b[0m", logMessage); // merah
    else if (res.statusCode >= 400) console.log("\x1b[33m%s\x1b[0m", logMessage); // kuning
    else console.log("\x1b[32m%s\x1b[0m", logMessage); // hijau
  });

  next();
};
