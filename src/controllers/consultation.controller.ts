import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { AppError, NotFoundError } from "../utils/appError";
import { AuthRequest } from "../middlewares/auth.middleware";

// GET /api/v1/consultations
export const getConsultations = async (
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

    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.consultation.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        consultations,
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

// GET /api/v1/consultations/:id
export const getConsultation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string; // ✅ fix: line 47

    const isAdmin = ["ADMIN", "STAFF"].includes(req.user?.role || "");

    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!consultation) throw new NotFoundError("Consultation not found");
    if (!isAdmin && consultation.userId !== req.user?.userId)
      throw new AppError("Not authorized", 403);

    res.status(200).json({ success: true, data: { consultation } });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/consultations  (public - no auth required)
export const createConsultation = async (
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
      subject,
      message,
      preferredDate,
      preferredTime,
    } = req.body;

    const consultation = await prisma.consultation.create({
      data: {
        userId: req.user?.userId || null,
        customerName,
        customerEmail,
        customerPhone,
        companyName,
        subject,
        message,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        preferredTime,
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      message:
        "Consultation request received. We will confirm your appointment shortly.",
      data: { consultation },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/consultations/:id  (staff/admin only)
export const updateConsultation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string; // ✅ fix: lines 99, 103

    const { scheduledDate } = req.body;

    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });
    if (!consultation) throw new NotFoundError("Consultation not found");

    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        ...req.body,
        ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
      },
    });

    res
      .status(200)
      .json({
        success: true,
        message: "Consultation updated",
        data: { consultation: updated },
      });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/consultations/:id  (admin only)
export const deleteConsultation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string; // ✅ fix: lines 120, 123

    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });
    if (!consultation) throw new NotFoundError("Consultation not found");

    await prisma.consultation.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Consultation deleted" });
  } catch (error) {
    next(error);
  }
};
