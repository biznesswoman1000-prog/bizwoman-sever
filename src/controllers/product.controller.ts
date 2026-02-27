import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { AppError, NotFoundError } from "../utils/appError";
import { AuthRequest } from "../middlewares/auth.middleware";

// GET /api/v1/products/shippable
// Returns only products that have: at least 1 image, weight set, and price > 0
// Useful for shipping calculators, catalogue exports, and featured displays
// that require complete product data.
export const getShippableProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = "1",
      limit = "12",
      categoryId,
      brandId,
      minPrice,
      maxPrice,
      sort = "newest",
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      status: "ACTIVE",

      // Must have at least one image
      images: { isEmpty: false },

      // Must have weight defined and > 0
      weight: { not: null, gt: 0 },

      // Must have a price > 0
      price: { gt: 0 },
    };

    // Optional filters
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (minPrice) where.price = { ...where.price, gte: Number(minPrice) };
    if (maxPrice) where.price = { ...where.price, lte: Number(maxPrice) };

    const orderBy: any = {
      newest: { createdAt: "desc" },
      oldest: { createdAt: "asc" },
      "price-asc": { price: "asc" },
      "price-desc": { price: "desc" },
      "name-asc": { name: "asc" },
      "name-desc": { name: "desc" },
      popular: { salesCount: "desc" },
    }[sort as string] || { createdAt: "desc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          price: true,
          comparePrice: true,
          images: true,
          weight: true,
          stockQuantity: true,
          status: true,
          isFeatured: true,
          isNewArrival: true,
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, logo: true } },
          _count: { select: { reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
          hasMore: skip + products.length < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/products/:id
export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    // MongoDB ObjectId is exactly 24 hex characters
    const isObjectId = /^[a-f\d]{24}$/i.test(id);

    const product = await prisma.product.findFirst({
      where: isObjectId ? { OR: [{ id }, { slug: id }] } : { slug: id },
      include: {
        category: true,
        brand: true,
        reviews: {
          where: { isApproved: true },
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) throw new NotFoundError("Product not found");

    // Increment view count
    await prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    });

    // Calculate average rating
    const avgRating = product.reviews.length
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) /
        product.reviews.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        product: { ...product, averageRating: Math.round(avgRating * 10) / 10 },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/products
export const createProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      name,
      slug,
      description,
      shortDescription,
      sku,
      barcode,
      price,
      comparePrice,
      costPrice,
      trackInventory,
      stockQuantity,
      lowStockThreshold,
      allowBackorder,
      images,
      videos,
      categoryId,
      brandId,
      tags,
      specifications,
      features,
      weight,
      length,
      width,
      height,
      metaTitle,
      metaDescription,
      metaKeywords,
      status,
      isFeatured,
      isNewArrival,
    } = req.body;

    // Validate unique slug
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug)
      throw new AppError("Product with this slug already exists", 409);

    // Validate unique SKU
    const existingSku = await prisma.product.findUnique({ where: { sku } });
    if (existingSku)
      throw new AppError("Product with this SKU already exists", 409);

    // Validate category exists
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) throw new NotFoundError("Category not found");
    }

    // Create product with all fields including SEO
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || "",
        shortDescription,
        sku,
        barcode,
        price,
        comparePrice,
        costPrice,
        trackInventory: trackInventory ?? true,
        stockQuantity: stockQuantity ?? 0,
        lowStockThreshold: lowStockThreshold ?? 10,
        allowBackorder: allowBackorder ?? false,
        images: images ?? [],
        videos: videos ?? [],
        categoryId,
        brandId,
        tags: tags ?? [],
        specifications,
        features: features ?? [],
        weight,
        length,
        width,
        height,
        // SEO fields
        metaTitle,
        metaDescription,
        metaKeywords,
        status: status ?? "DRAFT",
        isFeatured: isFeatured ?? false,
        isNewArrival: isNewArrival ?? false,
      },
      include: { category: true, brand: true },
    });

    // Log inventory if initial stock provided
    if (stockQuantity && stockQuantity > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          type: "PURCHASE",
          quantity: stockQuantity,
          previousQty: 0,
          newQty: stockQuantity,
          reason: "Initial stock",
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/products/:id
export const updateProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError("Product not found");

    const { slug, sku, categoryId, ...rest } = req.body;

    // Validate slug if changed
    if (slug && slug !== product.slug) {
      const existing = await prisma.product.findFirst({
        where: { slug, NOT: { id } },
      });
      if (existing) throw new AppError("Slug already in use", 409);
    }

    // Validate SKU if changed
    if (sku && sku !== product.sku) {
      const existing = await prisma.product.findFirst({
        where: { sku, NOT: { id } },
      });
      if (existing) throw new AppError("SKU already in use", 409);
    }

    // Update product with all fields
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(slug && { slug }),
        ...(sku && { sku }),
        ...(categoryId && { categoryId }),
      },
      include: { category: true, brand: true },
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: { product: updated },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/products/:id
export const deleteProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError("Product not found");

    await prisma.product.delete({ where: { id } });

    res
      .status(200)
      .json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/products/featured
export const getFeaturedProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { limit = "8" } = req.query;

    const products = await prisma.product.findMany({
      where: { isFeatured: true, status: "ACTIVE" },
      take: Number(limit),
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, logo: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/products/new-arrivals
export const getNewArrivals = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { limit = "8" } = req.query;

    const products = await prisma.product.findMany({
      where: { isNewArrival: true, status: "ACTIVE" },
      take: Number(limit),
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, logo: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: { products } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/products/:id/inventory
export const updateInventory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const { type, quantity, reason } = req.body;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError("Product not found");

    const previousQty = product.stockQuantity;
    let newQty: number;

    if (type === "PURCHASE" || type === "RETURN") {
      newQty = previousQty + quantity;
    } else if (type === "SALE" || type === "ADJUSTMENT") {
      newQty = previousQty - quantity;
      if (newQty < 0 && !product.allowBackorder)
        throw new AppError("Insufficient stock", 400);
    } else {
      newQty = quantity;
    }

    const [updated] = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          stockQuantity: newQty,
          status: newQty <= 0 ? "OUT_OF_STOCK" : "ACTIVE",
        },
      }),
      prisma.inventoryLog.create({
        data: { productId: id, type, quantity, previousQty, newQty, reason },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Inventory updated",
      data: { product: updated },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/products
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = "1",
      limit = "12",
      search,
      categoryId,
      brandId,
      minPrice,
      maxPrice,
      inStock,
      isFeatured,
      isNewArrival,
      status = "ACTIVE",
      sort = "newest",
      tags,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { status: "ACTIVE" };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { sku: { contains: search as string, mode: "insensitive" } },
        { tags: { has: search as string } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }
    if (inStock === "true") where.stockQuantity = { gt: 0 };
    if (isFeatured === "true") where.isFeatured = true;
    if (isNewArrival === "true") where.isNewArrival = true;
    if (tags) where.tags = { hasSome: (tags as string).split(",") };

    // ✅ Handle random sorting
    let products;
    let orderBy: any;

    if (sort === "random") {
      // For random sorting, fetch all matching products then shuffle
      const allProducts = await prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true, logo: true } },
          _count: { select: { reviews: true } },
        },
      });

      // Shuffle using Fisher-Yates algorithm
      const shuffled = [...allProducts];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Apply pagination to shuffled results
      products = shuffled.slice(skip, skip + Number(limit));
    } else {
      // Normal sorting
      orderBy = {
        newest: { createdAt: "desc" },
        oldest: { createdAt: "asc" },
        "price-asc": { price: "asc" },
        "price-desc": { price: "desc" },
        "name-asc": { name: "asc" },
        "name-desc": { name: "desc" },
        popular: { salesCount: "desc" },
      }[sort as string] || { createdAt: "desc" };

      products = await prisma.product.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true, logo: true } },
          _count: { select: { reviews: true } },
        },
      });
    }

    const total = await prisma.product.count({ where });

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
          hasMore: skip + products.length < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
