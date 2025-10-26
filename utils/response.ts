import { Response } from "express";

export const HttpResponse = {
  ok: (res: Response, message: string, data?: any) =>
    res.status(200).json({ success: true, message, data }),

  created: (res: Response, message: string, data?: any) =>
    res.status(201).json({ success: true, message, data }),

  badRequest: (res: Response, message: string) =>
    res.status(400).json({ success: false, message }),

  unauthorized: (res: Response, message = "Unauthorized") =>
    res.status(401).json({ success: false, message }),

  notFound: (res: Response, message = "Not Found") =>
    res.status(404).json({ success: false, message }),

  serverError: (res: Response, message = "Internal Server Error") =>
    res.status(500).json({ success: false, message }),
};
