import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { AppError, NotFoundError } from "../utils/appError";
import { AuthRequest } from "../middlewares/auth.middleware";

// GET /api/v1/quotations
export const getQuotations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { page = "1", limit = "10", status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const isAdmin = ["ADMIN", "STAFF"].includes(req.user?.role || "");

    const where: any = {};
    if (!isAdmin) where.userId = req.user?.userId;
    if (status) where.status = status;

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.quotation.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        quotations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/quotations/:id
export const getQuotation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string; // ✅ fix: line 47

    const isAdmin = ["ADMIN", "STAFF"].includes(req.user?.role || "");

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!quotation) throw new NotFoundError("Quotation not found");
    if (!isAdmin && quotation.userId !== req.user?.userId)
      throw new AppError("Not authorized", 403);

    res.status(200).json({ success: true, data: { quotation } });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/quotations
export const createQuotation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      companyName,
      items,
      message,
    } = req.body;

    const quotation = await prisma.quotation.create({
      data: {
        userId: req.user?.userId || null,
        customerName,
        customerEmail,
        customerPhone,
        companyName,
        items,
        message,
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      message:
        "Quotation request submitted. We will contact you within 24 hours.",
      data: { quotation },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/quotations/:id
export const updateQuotation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string; // ✅ fix: lines 94, 106

    const { status, adminNotes, totalEstimate, quotationFile } = req.body;

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) throw new NotFoundError("Quotation not found");

    const updates: any = {};
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (totalEstimate !== undefined) updates.totalEstimate = totalEstimate;
    if (quotationFile) updates.quotationFile = quotationFile;
    if (status === "CONVERTED") updates.convertedAt = new Date();

    const updated = await prisma.quotation.update({
      where: { id },
      data: updates,
    });
    res
      .status(200)
      .json({
        success: true,
        message: "Quotation updated",
        data: { quotation: updated },
      });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/quotations/:id
export const deleteQuotation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string; // ✅ fix: lines 117, 120

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) throw new NotFoundError("Quotation not found");

    await prisma.quotation.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Quotation deleted" });
  } catch (error) {
    next(error);
  }
};
