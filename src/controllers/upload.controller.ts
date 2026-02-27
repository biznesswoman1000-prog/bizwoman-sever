// src/controllers/upload.controller.ts
import { Response, NextFunction } from "express";
import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../utils/appError";
import { AuthRequest } from "../middlewares/auth.middleware";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const toDataURI = (file: Express.Multer.File) =>
  `data:${file.mimetype};base64,${Buffer.from(file.buffer).toString("base64")}`;

const uploadOptions = {
  transformation: [{ quality: "auto", fetch_format: "auto" }],
};

// POST /api/v1/upload/image
export const uploadImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) throw new AppError("No file provided", 400);

    const folder = `super-business-woman/${req.body.folder || "general"}`;
    const result = await cloudinary.uploader.upload(toDataURI(req.file), {
      folder,
      ...uploadOptions,
    });

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/upload/images
export const uploadImages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new AppError("No files provided", 400);
    }
    if (req.files.length > 10)
      throw new AppError("Maximum 10 files allowed per upload", 400);

    const folder = `super-business-woman/${req.body.folder || "general"}`;

    const uploads = await Promise.all(
      req.files.map((file) =>
        cloudinary.uploader
          .upload(toDataURI(file), { folder, ...uploadOptions })
          .then((r) => ({
            url: r.secure_url,
            publicId: r.public_id,
            width: r.width,
            height: r.height,
            format: r.format,
          })),
      ),
    );

    res.status(200).json({ success: true, data: { images: uploads } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/upload
export const deleteUpload = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { publicId } = req.body;
    if (!publicId) throw new AppError("publicId is required", 400);

    await cloudinary.uploader.destroy(publicId);
    res.status(200).json({ success: true, message: "Image deleted" });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/upload/bulk
export const deleteBulkUploads = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { publicIds } = req.body;
    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      throw new AppError("publicIds array is required", 400);
    }

    await cloudinary.api.delete_resources(publicIds);
    res
      .status(200)
      .json({ success: true, message: `${publicIds.length} image(s) deleted` });
  } catch (error) {
    next(error);
  }
};
