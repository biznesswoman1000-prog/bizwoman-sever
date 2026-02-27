import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { AppError, NotFoundError } from "../utils/appError";
import { AuthRequest } from "../middlewares/auth.middleware";

// GET /api/v1/cart
export const getCart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.cookies.cartSession;

    const where = userId ? { userId } : { sessionId };
    if (!userId && !sessionId) {
      return res.status(200).json({
        success: true,
        data: {
          cart: null,
          items: [],
          summary: { subtotal: 0, itemCount: 0 },
        },
      });
    }

    const cart = await prisma.cart.findFirst({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
                price: true,
                stockQuantity: true,
                status: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          cart: null,
          items: [],
          summary: { subtotal: 0, itemCount: 0 },
        },
      });
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    res.status(200).json({
      success: true,
      data: { cart, items: cart.items, summary: { subtotal, itemCount } },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cart
export const addToCart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user?.userId;
    let sessionId = req.cookies.cartSession;

    // Create session for guests
    if (!userId && !sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.cookie("cartSession", sessionId, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundError("Product not found");
    if (product.status !== "ACTIVE")
      throw new AppError("Product is not available", 400);
    if (!product.allowBackorder && product.stockQuantity < quantity) {
      throw new AppError(
        `Only ${product.stockQuantity} item(s) available in stock`,
        400,
      );
    }

    const where = userId ? { userId } : { sessionId };

    // Find or create cart
    let cart = await prisma.cart.findFirst({ where });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { ...(userId ? { userId } : { sessionId }) },
      });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (!product.allowBackorder && product.stockQuantity < newQty) {
        throw new AppError(
          `Only ${product.stockQuantity} item(s) available`,
          400,
        );
      }
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity, price: product.price },
      });
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                price: true,
                stockQuantity: true,
              },
            },
          },
        },
      },
    });

    const subtotal = updatedCart!.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const itemCount = updatedCart!.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    res.status(200).json({
      success: true,
      message: "Item added to cart",
      data: { cart: updatedCart, summary: { subtotal, itemCount } },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/cart/:itemId
export const updateCartItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const itemId = req.params.itemId as string; // ✅ fix: assert as string

    const { quantity } = req.body;

    if (quantity < 1) throw new AppError("Quantity must be at least 1", 400);

    // ✅ fix: include product in the query so item.product is available
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });
    if (!item) throw new NotFoundError("Cart item not found");

    if (!item.product.allowBackorder && item.product.stockQuantity < quantity) {
      throw new AppError(
        `Only ${item.product.stockQuantity} item(s) available`,
        400,
      );
    }

    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } }); // ✅ fix: use asserted itemId

    res.status(200).json({ success: true, message: "Cart updated" });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cart/:itemId
export const removeCartItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const itemId = req.params.itemId as string; // ✅ fix: assert as string

    const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundError("Cart item not found");

    await prisma.cartItem.delete({ where: { id: itemId } }); // ✅ fix: use asserted itemId

    res.status(200).json({ success: true, message: "Item removed from cart" });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cart
export const clearCart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.cookies.cartSession;

    const where = userId ? { userId } : { sessionId };
    const cart = await prisma.cart.findFirst({ where });

    if (cart) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cart/merge - Merge guest cart with user cart on login
export const mergeCart = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) return next();
    const userId = req.user.userId;
    const sessionId = req.cookies.cartSession;

    if (!sessionId)
      return res
        .status(200)
        .json({ success: true, message: "No guest cart to merge" });

    const guestCart = await prisma.cart.findFirst({
      where: { sessionId },
      include: { items: true },
    });

    if (!guestCart || guestCart.items.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: "No guest cart to merge" });
    }

    let userCart = await prisma.cart.findFirst({ where: { userId } });
    if (!userCart) {
      userCart = await prisma.cart.create({ data: { userId } });
    }

    // Merge items
    for (const guestItem of guestCart.items) {
      const existing = await prisma.cartItem.findFirst({
        where: { cartId: userCart.id, productId: guestItem.productId },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + guestItem.quantity },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: guestItem.productId,
            quantity: guestItem.quantity,
            price: guestItem.price,
          },
        });
      }
    }

    // Delete guest cart
    await prisma.cart.delete({ where: { id: guestCart.id } });
    res.clearCookie("cartSession");

    res
      .status(200)
      .json({ success: true, message: "Cart merged successfully" });
  } catch (error) {
    next(error);
  }
};
