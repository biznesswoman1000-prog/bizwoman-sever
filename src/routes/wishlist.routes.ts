import { Router } from "express";
import {
  getWishlist,
  toggleWishlistItem,
  removeWishlistItem,
  clearWishlist,
} from "../controllers/wishlist.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.use(protect); // All wishlist routes require auth

router.get("/", getWishlist);
router.post("/:productId", toggleWishlistItem);
router.delete("/:productId", removeWishlistItem);
router.delete("/", clearWishlist);

export default router;
