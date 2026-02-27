import { Router } from "express";
import {
  getShippingZones,
  getAllShippingZones,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  createShippingMethod,
  getShippingMethod,
  updateShippingMethod,
  deleteShippingMethod,
  calculateShipping,
} from "../controllers/shipping.controller";
import { protect, staffOrAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.get("/zones", getShippingZones);
router.post("/calculate", calculateShipping);

// Admin routes - Zones
router.use(protect, staffOrAdmin);
router.get("/zones/all", getAllShippingZones);
router.post("/zones", createShippingZone);
router.put("/zones/:id", updateShippingZone);
router.delete("/zones/:id", deleteShippingZone);

// Admin routes - Methods
router.post("/methods", createShippingMethod);
router.get("/methods/:id", getShippingMethod);
router.put("/methods/:id", updateShippingMethod);
router.delete("/methods/:id", deleteShippingMethod);

export default router;
