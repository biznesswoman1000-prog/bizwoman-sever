import { Router } from 'express';
import {
  getDashboardStats, getRevenueChart, getTopProducts,
  getInventoryReport, getCustomerStats, getOrdersByStatus,
} from '../controllers/analytics.controller';
import { protect, staffOrAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect, staffOrAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/revenue', getRevenueChart);
router.get('/top-products', getTopProducts);
router.get('/inventory', getInventoryReport);
router.get('/customers', getCustomerStats);
router.get('/orders-by-status', getOrdersByStatus);

export default router;
