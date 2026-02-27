import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { BadRequestError, NotFoundError } from "../utils/appError";
import { AuthRequest } from "../middlewares/auth.middleware";
import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createZoneSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  states: z.array(z.string()).min(1, "At least one state is required"),
  isActive: z.boolean().default(true),
});

const updateZoneSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  states: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

const createMethodSchema = z.object({
  zoneId: z.string(),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["TABLE_RATE", "FLAT_RATE", "STORE_PICKUP"]),
  isActive: z.boolean().default(true),

  // Flat rate specific
  flatRateCost: z.number().min(0).optional(),

  // Scoping
  applicableToAll: z.boolean().default(true),
  categoryIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),

  // Store pickup specific
  storeAddress: z
    .object({
      name: z.string(),
      address: z.string(),
      city: z.string(),
      phone: z.string(),
      hours: z.string(),
    })
    .optional(),

  // Delivery estimate
  estimatedMinDays: z.number().int().min(0).optional(),
  estimatedMaxDays: z.number().int().min(0).optional(),

  // Weight rates for TABLE_RATE
  weightRates: z
    .array(
      z.object({
        minWeight: z.number().min(0),
        maxWeight: z.number().min(0).nullable(),
        cost: z.number().min(0),
      }),
    )
    .optional(),
});

const updateMethodSchema = createMethodSchema.partial().omit({ zoneId: true });

const calculateShippingSchema = z.object({
  state: z.string().min(1, "State is required"),
  orderAmount: z.number().min(0),
  weight: z.number().min(0),
  categoryIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([]),
});

// ============================================
// SHIPPING ZONES
// ============================================

/**
 * Get all active shipping zones (Public)
 * GET /api/v1/shipping/zones
 */
export const getShippingZones = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const zones = await prisma.shippingZone.findMany({
      where: { isActive: true },
      include: {
        methods: {
          where: { isActive: true },
          include: {
            weightRates: {
              orderBy: { minWeight: "asc" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      data: { zones },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all shipping zones including inactive (Admin)
 * GET /api/v1/shipping/zones/all
 */
export const getAllShippingZones = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const zones = await prisma.shippingZone.findMany({
      include: {
        _count: {
          select: { methods: true },
        },
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      data: { zones },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single shipping zone by ID (Admin)
 * GET /api/v1/shipping/zones/:id
 */
export const getShippingZone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    const zone = await prisma.shippingZone.findUnique({
      where: { id },
      include: {
        methods: {
          include: {
            weightRates: {
              orderBy: { minWeight: "asc" },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!zone) {
      throw new NotFoundError("Shipping zone not found");
    }

    res.status(200).json({
      success: true,
      data: { zone },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create shipping zone (Admin)
 * POST /api/v1/shipping/zones
 */
export const createShippingZone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validated = createZoneSchema.parse(req.body);

    // Check if states are already in another zone
    const existingZone = await prisma.shippingZone.findFirst({
      where: {
        states: {
          hasSome: validated.states,
        },
      },
    });

    if (existingZone) {
      throw new BadRequestError(
        `Some states are already in zone "${existingZone.name}"`,
      );
    }

    const zone = await prisma.shippingZone.create({
      data: validated,
    });

    res.status(201).json({
      success: true,
      data: { zone },
      message: "Shipping zone created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }
    next(error);
  }
};

/**
 * Update shipping zone (Admin)
 * PUT /api/v1/shipping/zones/:id
 */
export const updateShippingZone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const validated = updateZoneSchema.parse(req.body);

    // Check if zone exists
    const existingZone = await prisma.shippingZone.findUnique({
      where: { id },
    });

    if (!existingZone) {
      throw new NotFoundError("Shipping zone not found");
    }

    // If updating states, check for conflicts
    if (validated.states) {
      const conflictZone = await prisma.shippingZone.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              states: {
                hasSome: validated.states,
              },
            },
          ],
        },
      });

      if (conflictZone) {
        throw new BadRequestError(
          `Some states are already in zone "${conflictZone.name}"`,
        );
      }
    }

    const zone = await prisma.shippingZone.update({
      where: { id },
      data: validated,
    });

    res.status(200).json({
      success: true,
      data: { zone },
      message: "Zone updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }
    next(error);
  }
};

/**
 * Delete shipping zone (Admin)
 * DELETE /api/v1/shipping/zones/:id
 */
export const deleteShippingZone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    // Check if zone has methods
    const zone = await prisma.shippingZone.findUnique({
      where: { id },
      include: {
        _count: {
          select: { methods: true },
        },
      },
    });

    if (!zone) {
      throw new NotFoundError("Shipping zone not found");
    }

    if (zone._count.methods > 0) {
      throw new BadRequestError(
        "Cannot delete zone with shipping methods. Delete methods first.",
      );
    }

    await prisma.shippingZone.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Zone deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// SHIPPING METHODS
// ============================================

/**
 * Create shipping method (Admin)
 * POST /api/v1/shipping/methods
 */
export const createShippingMethod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validated = createMethodSchema.parse(req.body);

    // Validate zone exists
    const zone = await prisma.shippingZone.findUnique({
      where: { id: validated.zoneId },
    });

    if (!zone) {
      throw new NotFoundError("Shipping zone not found");
    }

    // Validate based on type
    if (validated.type === "FLAT_RATE" && !validated.flatRateCost) {
      throw new BadRequestError(
        "Flat rate cost is required for FLAT_RATE type",
      );
    }

    if (
      validated.type === "TABLE_RATE" &&
      (!validated.weightRates || validated.weightRates.length === 0)
    ) {
      throw new BadRequestError(
        "Weight rates are required for TABLE_RATE type",
      );
    }

    if (validated.type === "STORE_PICKUP" && !validated.storeAddress) {
      throw new BadRequestError(
        "Store address is required for STORE_PICKUP type",
      );
    }

    // Create method with weight rates if applicable
    const method = await prisma.shippingMethod.create({
      data: {
        zoneId: validated.zoneId,
        name: validated.name,
        type: validated.type,
        isActive: validated.isActive,
        flatRateCost: validated.flatRateCost,
        applicableToAll: validated.applicableToAll,
        categoryIds: validated.categoryIds,
        productIds: validated.productIds,
        storeAddress: validated.storeAddress as any,
        estimatedMinDays: validated.estimatedMinDays,
        estimatedMaxDays: validated.estimatedMaxDays,
        ...(validated.weightRates &&
          validated.weightRates.length > 0 && {
            weightRates: {
              create: validated.weightRates,
            },
          }),
      },
      include: {
        weightRates: true,
      },
    });

    res.status(201).json({
      success: true,
      data: { method },
      message: "Shipping method created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }
    next(error);
  }
};

/**
 * Get shipping method by ID (Admin)
 * GET /api/v1/shipping/methods/:id
 */
export const getShippingMethod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    const method = await prisma.shippingMethod.findUnique({
      where: { id },
      include: {
        zone: true,
        weightRates: {
          orderBy: { minWeight: "asc" },
        },
      },
    });

    if (!method) {
      throw new NotFoundError("Shipping method not found");
    }

    res.status(200).json({
      success: true,
      data: { method },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all shipping methods (Admin)
 * GET /api/v1/shipping/methods
 */
export const getAllShippingMethods = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const methods = await prisma.shippingMethod.findMany({
      include: {
        zone: {
          select: {
            id: true,
            name: true,
            states: true,
          },
        },
        weightRates: {
          orderBy: { minWeight: "asc" },
        },
      },
      orderBy: [{ zone: { name: "asc" } }, { name: "asc" }],
    });

    res.status(200).json({
      success: true,
      data: { methods },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shipping method (Admin)
 * PUT /api/v1/shipping/methods/:id
 */
export const updateShippingMethod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const validated = updateMethodSchema.parse(req.body);

    const existingMethod = await prisma.shippingMethod.findUnique({
      where: { id },
      include: { weightRates: true },
    });

    if (!existingMethod) {
      throw new NotFoundError("Shipping method not found");
    }

    // If updating weight rates, delete old ones first
    if (validated.weightRates) {
      await prisma.shippingWeightRate.deleteMany({
        where: { methodId: id },
      });
    }

    const method = await prisma.shippingMethod.update({
      where: { id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.type && { type: validated.type }),
        ...(validated.isActive !== undefined && {
          isActive: validated.isActive,
        }),
        ...(validated.flatRateCost !== undefined && {
          flatRateCost: validated.flatRateCost,
        }),
        ...(validated.applicableToAll !== undefined && {
          applicableToAll: validated.applicableToAll,
        }),
        ...(validated.categoryIds && { categoryIds: validated.categoryIds }),
        ...(validated.productIds && { productIds: validated.productIds }),
        ...(validated.storeAddress && {
          storeAddress: validated.storeAddress as any,
        }),
        ...(validated.estimatedMinDays !== undefined && {
          estimatedMinDays: validated.estimatedMinDays,
        }),
        ...(validated.estimatedMaxDays !== undefined && {
          estimatedMaxDays: validated.estimatedMaxDays,
        }),
        ...(validated.weightRates && {
          weightRates: {
            create: validated.weightRates,
          },
        }),
      },
      include: {
        weightRates: true,
      },
    });

    res.status(200).json({
      success: true,
      data: { method },
      message: "Method updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }
    next(error);
  }
};

/**
 * Delete shipping method (Admin)
 * DELETE /api/v1/shipping/methods/:id
 */
export const deleteShippingMethod = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    const method = await prisma.shippingMethod.findUnique({
      where: { id },
    });

    if (!method) {
      throw new NotFoundError("Shipping method not found");
    }

    // Delete weight rates first (cascade should handle this, but being explicit)
    await prisma.shippingWeightRate.deleteMany({
      where: { methodId: id },
    });

    await prisma.shippingMethod.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Method deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// SHIPPING CALCULATION
// ============================================

/**
 * Calculate shipping cost (Public)
 * POST /api/v1/shipping/calculate
 */
export const calculateShipping = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const validated = calculateShippingSchema.parse(req.body);
    const { state, orderAmount, weight, categoryIds, productIds } = validated;

    // Find zone for the state
    const zone = await prisma.shippingZone.findFirst({
      where: {
        isActive: true,
        states: {
          has: state,
        },
      },
      include: {
        methods: {
          where: { isActive: true },
          include: {
            weightRates: {
              orderBy: { minWeight: "asc" },
            },
          },
        },
      },
    });

    if (!zone || zone.methods.length === 0) {
      // Return default shipping if no zone found
      return res.status(200).json({
        success: true,
        data: {
          zone: "Default Zone",
          methods: [
            {
              id: "default",
              name: "Standard Shipping",
              type: "FLAT_RATE",
              cost: 5000,
              estimatedMinDays: 5,
              estimatedMaxDays: 7,
            },
          ],
        },
      });
    }

    // Filter methods by applicability
    const applicableMethods = zone.methods.filter((method) => {
      // Store pickup is always applicable
      if (method.type === "STORE_PICKUP") return true;

      // If applicable to all, include it
      if (method.applicableToAll) return true;

      // Check category match
      if (method.categoryIds.length > 0) {
        const hasMatchingCategory = categoryIds.some((catId) =>
          method.categoryIds.includes(catId),
        );
        if (hasMatchingCategory) return true;
      }

      // Check product match
      if (method.productIds.length > 0) {
        const hasMatchingProduct = productIds.some((prodId) =>
          method.productIds.includes(prodId),
        );
        if (hasMatchingProduct) return true;
      }

      return false;
    });

    // Calculate cost for each method
    const methodsWithCost = applicableMethods.map((method) => {
      let cost = 0;

      switch (method.type) {
        case "FLAT_RATE":
          cost = method.flatRateCost || 0;
          break;

        case "TABLE_RATE":
          // Find applicable weight rate
          const applicableRate = method.weightRates.find((rate) => {
            const meetsMin = weight >= rate.minWeight;
            const meetsMax =
              rate.maxWeight === null || weight <= rate.maxWeight;
            return meetsMin && meetsMax;
          });

          if (applicableRate) {
            cost = applicableRate.cost;
          } else {
            // If no rate found, use the highest rate
            const highestRate =
              method.weightRates[method.weightRates.length - 1];
            cost = highestRate?.cost || 0;
          }
          break;

        case "STORE_PICKUP":
          cost = 0;
          break;
      }

      return {
        id: method.id,
        name: method.name,
        type: method.type,
        cost,
        estimatedMinDays: method.estimatedMinDays,
        estimatedMaxDays: method.estimatedMaxDays,
        storeAddress: method.storeAddress,
      };
    });

    // Sort by cost (cheapest first)
    methodsWithCost.sort((a, b) => a.cost - b.cost);

    res.status(200).json({
      success: true,
      data: {
        zone: zone.name,
        methods: methodsWithCost,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }
    next(error);
  }
};
