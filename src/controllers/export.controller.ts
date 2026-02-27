import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import prisma from "../config/database";
import { AppError } from "../utils/appError";
import PDFDocument from "pdfkit";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CSVProductRow {
  id?: string;
  name: string;
  slug?: string;
  sku: string;
  description?: string;
  shortDescription?: string;
  price: string;
  comparePrice?: string;
  costPrice?: string;
  stockQuantity?: string;
  lowStockThreshold?: string;
  category?: string;
  categoryId: string;
  brand?: string;
  brandId?: string;
  status?: string;
  isFeatured?: string;
  isNewArrival?: string;
  tags?: string;
  weight?: string;
  length?: string;
  width?: string;
  height?: string;
  images?: string;
  videos?: string;
  barcode?: string;
  allowBackorder?: string;
  trackInventory?: string;
  viewCount?: string;
  salesCount?: string;
  // SEO Fields
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  // Additional Fields
  features?: string;
  specifications?: string;
  createdAt?: string;
}

// ============================================
// EXPORT PRODUCTS AS CSV
// ============================================
export const exportProductsCSV = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        brand: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const csvData = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      description: p.description,
      shortDescription: p.shortDescription || "",
      price: p.price,
      comparePrice: p.comparePrice || "",
      costPrice: p.costPrice || "",
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      category: p.category.name,
      categoryId: p.categoryId,
      brand: p.brand?.name || "",
      brandId: p.brandId || "",
      status: p.status,
      isFeatured: p.isFeatured,
      isNewArrival: p.isNewArrival,
      tags: p.tags.join("|"),
      weight: p.weight || "",
      length: p.length || "",
      width: p.width || "",
      height: p.height || "",
      images: p.images.join("|"),
      videos: p.videos.join("|"),
      barcode: p.barcode || "",
      allowBackorder: p.allowBackorder,
      trackInventory: p.trackInventory,
      // SEO Fields
      metaTitle: p.metaTitle || "",
      metaDescription: p.metaDescription || "",
      metaKeywords: p.metaKeywords || "",
      // Additional Fields
      features: p.features.join("|"),
      specifications: p.specifications ? JSON.stringify(p.specifications) : "",
      viewCount: p.viewCount,
      salesCount: p.salesCount,
      createdAt: p.createdAt.toISOString(),
    }));

    const csv = stringify(csvData, {
      header: true,
      columns: [
        "id",
        "name",
        "slug",
        "sku",
        "description",
        "shortDescription",
        "price",
        "comparePrice",
        "costPrice",
        "stockQuantity",
        "lowStockThreshold",
        "category",
        "categoryId",
        "brand",
        "brandId",
        "status",
        "isFeatured",
        "isNewArrival",
        "tags",
        "weight",
        "length",
        "width",
        "height",
        "images",
        "videos",
        "barcode",
        "allowBackorder",
        "trackInventory",
        "metaTitle",
        "metaDescription",
        "metaKeywords",
        "features",
        "specifications",
        "viewCount",
        "salesCount",
        "createdAt",
      ],
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="products-${Date.now()}.csv"`,
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// ============================================
// EXPORT PRODUCTS AS PDF
// ============================================
export const exportProductsPDF = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        category: true,
        brand: true,
      },
      orderBy: { name: "asc" },
    });

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="products-${Date.now()}.pdf"`,
    );

    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Product Inventory Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc
      .text(`Total Products: ${products.length}`, { align: "center" })
      .moveDown(1.5);

    // Table headers
    const tableTop = doc.y;
    const colWidths = [180, 80, 80, 80, 80];
    const headers = ["Product", "SKU", "Price", "Stock", "Status"];

    doc.fontSize(9).font("Helvetica-Bold");
    headers.forEach((header, i) => {
      const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(header, x, tableTop, { width: colWidths[i], align: "left" });
    });

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Table rows
    let y = tableTop + 25;
    doc.fontSize(8).font("Helvetica");

    products.forEach((product, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const rowData = [
        product.name.substring(0, 40),
        product.sku,
        `NGN ${product.price.toLocaleString()}`,
        `${product.stockQuantity}`,
        product.status,
      ];

      rowData.forEach((data, i) => {
        const x = 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(data, x, y, { width: colWidths[i], align: "left" });
      });

      y += 20;

      // Add line between rows
      if (index < products.length - 1) {
        doc
          .strokeColor("#e5e7eb")
          .moveTo(50, y - 5)
          .lineTo(550, y - 5)
          .stroke();
      }
    });

    // Footer
    doc
      .moveDown(2)
      .fontSize(8)
      .font("Helvetica")
      .text("EquipUniverse", 50, doc.page.height - 50, {
        align: "center",
      });

    doc.end();
  } catch (error) {
    next(error);
  }
};

// ============================================
// IMPORT PRODUCTS FROM CSV
// ============================================
export const importProductsCSV = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      throw new AppError("Please upload a CSV file", 400);
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVProductRow[];

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data: any }>,
    };

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        // Validate required fields
        if (!row.name || !row.sku || !row.price || !row.categoryId) {
          throw new Error(
            "Missing required fields: name, sku, price, or categoryId",
          );
        }

        // Check if product exists (update) or create new
        const existingProduct = await prisma.product.findFirst({
          where: {
            OR: [{ sku: row.sku }, { slug: row.slug || "" }],
          },
        });

        // Parse specifications if present
        let specifications = null;
        if (row.specifications) {
          try {
            specifications = JSON.parse(row.specifications);
          } catch (e) {
            // If parsing fails, ignore specifications
            console.warn(`Failed to parse specifications for row ${i + 2}`);
          }
        }

        const productData = {
          name: row.name,
          slug: row.slug || row.name.toLowerCase().replace(/\s+/g, "-"),
          sku: row.sku,
          description: row.description || "",
          shortDescription: row.shortDescription || null,
          price: parseFloat(row.price),
          comparePrice: row.comparePrice ? parseFloat(row.comparePrice) : null,
          costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
          stockQuantity: row.stockQuantity ? parseInt(row.stockQuantity) : 0,
          lowStockThreshold: row.lowStockThreshold
            ? parseInt(row.lowStockThreshold)
            : 10,
          categoryId: row.categoryId,
          brandId: row.brandId || null,
          status: (row.status || "DRAFT") as any,
          isFeatured: row.isFeatured === "true" || row.isFeatured === "TRUE",
          isNewArrival:
            row.isNewArrival === "true" || row.isNewArrival === "TRUE",
          tags: row.tags ? row.tags.split("|").filter(Boolean) : [],
          weight: row.weight ? parseFloat(row.weight) : null,
          length: row.length ? parseFloat(row.length) : null,
          width: row.width ? parseFloat(row.width) : null,
          height: row.height ? parseFloat(row.height) : null,
          images: row.images ? row.images.split("|").filter(Boolean) : [],
          videos: row.videos ? row.videos.split("|").filter(Boolean) : [],
          barcode: row.barcode || null,
          allowBackorder:
            row.allowBackorder === "true" || row.allowBackorder === "TRUE",
          trackInventory:
            row.trackInventory === "true" || row.trackInventory === "TRUE",
          // SEO Fields
          metaTitle: row.metaTitle || null,
          metaDescription: row.metaDescription || null,
          metaKeywords: row.metaKeywords || null,
          // Additional Fields
          features: row.features ? row.features.split("|").filter(Boolean) : [],
          specifications: specifications,
        };

        if (existingProduct) {
          // Update existing product
          await prisma.product.update({
            where: { id: existingProduct.id },
            data: productData,
          });
        } else {
          // Create new product
          await prisma.product.create({
            data: productData,
          });
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 2, // +2 because of header row and 0-index
          error: error.message,
          data: row,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DOWNLOAD CSV TEMPLATE
// ============================================
export const downloadCSVTemplate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const template = [
      {
        name: "Sample Product",
        slug: "sample-product",
        sku: "SKU001",
        description: "Product description here",
        shortDescription: "Short description",
        price: "10000",
        comparePrice: "12000",
        costPrice: "8000",
        stockQuantity: "50",
        lowStockThreshold: "10",
        categoryId: "category-id-here",
        brandId: "brand-id-here",
        status: "ACTIVE",
        isFeatured: "false",
        isNewArrival: "false",
        tags: "tag1|tag2|tag3",
        weight: "0.5",
        length: "10",
        width: "10",
        height: "10",
        images: "https://example.com/image1.jpg|https://example.com/image2.jpg",
        videos: "https://example.com/video1.mp4",
        barcode: "123456789",
        allowBackorder: "false",
        trackInventory: "true",
        metaTitle: "Sample Product - Buy Online",
        metaDescription:
          "Shop Sample Product at great prices. Free delivery on orders over NGN 50,000.",
        metaKeywords: "sample, product, online shopping, Nigeria",
        features: "Durable|Eco-friendly|Made in Nigeria",
        specifications: '{"color":"Blue","size":"Medium","material":"Cotton"}',
      },
    ];

    const csv = stringify(template, { header: true });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=product-import-template.csv",
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// ============================================
// EXPORT PRODUCT CATALOGUE AS PDF (Public)
// ============================================
export const exportCataloguePDF = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { categoryId, featured } = req.query;

    const where: any = { status: "ACTIVE" };
    if (categoryId) where.categoryId = categoryId;
    if (featured === "true") where.isFeatured = true;

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
      },
      orderBy: { name: "asc" },
    });

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="product-catalogue-${Date.now()}.pdf"`,
    );

    doc.pipe(res);

    // Cover Page
    doc
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("Product Catalogue", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(18)
      .font("Helvetica")
      .text("EquipUniverse", { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(12)
      .text(new Date().getFullYear().toString(), { align: "center" })
      .moveDown(3);

    doc
      .fontSize(10)
      .text(`Total Products: ${products.length}`, { align: "center" })
      .text(`Generated: ${new Date().toLocaleDateString()}`, {
        align: "center",
      });

    doc.addPage();

    // Product listings - optimized for 4 products per page
    for (let index = 0; index < products.length; index++) {
      const product = products[index];

      // Add new page every 4 products
      if (index > 0 && index % 4 === 0) {
        doc.addPage();
      }

      const startY = doc.y;
      const leftMargin = 40;
      const imageSize = 80;
      const imageMargin = 12;
      const contentX = leftMargin + imageSize + imageMargin;
      const maxWidth = 460;

      // Add product image (first image from array)
      if (product.images && product.images.length > 0) {
        try {
          const imageUrl = product.images[0];
          const response = await fetch(imageUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            doc.image(Buffer.from(buffer), leftMargin, startY, {
              width: imageSize,
              height: imageSize,
              fit: [imageSize, imageSize],
            });
          }
        } catch (error) {
          // If image fails, draw a placeholder box
          doc.rect(leftMargin, startY, imageSize, imageSize).stroke("#e5e7eb");
          doc
            .fontSize(7)
            .fillColor("#999999")
            .text("No Image", leftMargin, startY + 35, {
              width: imageSize,
              align: "center",
            });
          doc.fillColor("#000000");
        }
      } else {
        // Draw placeholder box if no images
        doc.rect(leftMargin, startY, imageSize, imageSize).stroke("#e5e7eb");
        doc
          .fontSize(7)
          .fillColor("#999999")
          .text("No Image", leftMargin, startY + 35, {
            width: imageSize,
            align: "center",
          });
        doc.fillColor("#000000");
      }

      // Product name
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(product.name, contentX, startY, { width: maxWidth });

      // SKU and Category on same line
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#666666")
        .text(
          `SKU: ${product.sku} | ${product.category.name}`,
          contentX,
          doc.y + 3,
          { width: maxWidth },
        );

      // Description (truncated to 2 lines max)
      if (product.shortDescription) {
        const maxDescLength = 120;
        const truncatedDesc =
          product.shortDescription.length > maxDescLength
            ? product.shortDescription.substring(0, maxDescLength) + "..."
            : product.shortDescription;

        doc
          .fontSize(8)
          .fillColor("#333333")
          .text(truncatedDesc, contentX, doc.y + 3, {
            width: maxWidth,
            lineGap: 1,
          });
      }

      // Price and stock on same line
      const priceY = doc.y + 4;

      // Price
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#C71EFF")
        .text(`NGN ${product.price.toLocaleString()}`, contentX, priceY, {
          continued: false,
        });

      // Compare price (if exists)
      if (product.comparePrice && product.comparePrice > product.price) {
        const discount = Math.round(
          ((product.comparePrice - product.price) / product.comparePrice) * 100,
        );
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#999999")
          .text(
            `Was: NGN ${product.comparePrice.toLocaleString()} (-${discount}%)`,
            contentX,
            doc.y + 2,
            { width: maxWidth },
          );
      }

      // Stock status
      const stockStatus =
        product.stockQuantity > product.lowStockThreshold
          ? "In Stock"
          : product.stockQuantity > 0
            ? "Low Stock"
            : "Out of Stock";

      doc
        .fontSize(8)
        .fillColor(
          product.stockQuantity > product.lowStockThreshold
            ? "#10b981"
            : product.stockQuantity > 0
              ? "#f59e0b"
              : "#ef4444",
        )
        .text(stockStatus, contentX, doc.y + 3);

      doc.fillColor("#000000");

      // Calculate position for separator line
      const separatorY = Math.max(startY + imageSize + 8, doc.y + 8);

      // Separator line
      doc
        .strokeColor("#e5e7eb")
        .moveTo(leftMargin, separatorY)
        .lineTo(555, separatorY)
        .stroke();

      doc.y = separatorY + 10;

      // Check if we need a new page
      if (doc.y > 720 && index < products.length - 1) {
        doc.addPage();
      }
    }

    // Footer on last page
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#000000")
      .text(
        "For orders and inquiries, contact us at info@superbusinesswoman.com",
        40,
        doc.page.height - 60,
        { align: "center", width: 515 },
      );

    doc.end();
  } catch (error) {
    next(error);
  }
};
