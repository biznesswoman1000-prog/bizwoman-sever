import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middlewares/auth.middleware";

// GET /api/v1/settings
export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let settings = await prisma.siteSetting.findFirst();
    if (!settings) {
      settings = await prisma.siteSetting.create({ data: {} });
    }

    // Strip sensitive fields for non-admins
    const isAdmin = (req as AuthRequest).user?.role === "ADMIN";
    if (!isAdmin) {
      const {
        paystackSecretKey,
        smtpPassword,
        smsApiKey,
        smtpUser,
        smtpHost,
        smtpPort,
        ...publicSettings
      } = settings as any;
      return res
        .status(200)
        .json({ success: true, data: { settings: publicSettings } });
    }

    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings  (admin only)
export const updateSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let settings = await prisma.siteSetting.findFirst();
    if (!settings) {
      settings = await prisma.siteSetting.create({ data: {} });
    }

    // ✅ Filter out invalid fields and clean the data
    const validFields = [
      "siteName",
      "siteDescription",
      "siteKeywords",
      "logo",
      "favicon",
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "email",
      "phone",
      "address",
      "whatsapp",
      "facebook",
      "instagram",
      "twitter",
      "linkedin",
      "currency",
      "currencySymbol",
      "taxRate",
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "smtpPassword",
      "emailFrom",
      "emailFromName",
      "smsProvider",
      "smsApiKey",
      "smsSenderId",
      "paystackPublicKey",
      "paystackSecretKey",
      "googleAnalyticsId",
      "facebookPixelId",
      "metaTitle",
      "metaDescription",
      "metaImage",
      "metaKeywords", // ✅ Added
      "headerBanner",
      "showHeaderBanner",
      "maintenanceMode",
      "maintenanceMessage",
      "allowGuestCheckout",
    ];

    // ✅ Only keep valid fields and remove undefined/empty strings
    const data: any = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (validFields.includes(key) && value !== undefined && value !== "") {
        data[key] = value;
      }
    }

    // ✅ Handle special cases for boolean fields
    if (req.body.showHeaderBanner !== undefined) {
      data.showHeaderBanner = Boolean(req.body.showHeaderBanner);
    }
    if (req.body.maintenanceMode !== undefined) {
      data.maintenanceMode = Boolean(req.body.maintenanceMode);
    }
    if (req.body.allowGuestCheckout !== undefined) {
      data.allowGuestCheckout = Boolean(req.body.allowGuestCheckout);
    }

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Settings updated",
      data: { settings: updated },
    });
  } catch (error: any) {
    console.error("Settings update error:", error);
    next(error);
  }
};

// PUT /api/v1/settings/branding
export const updateBranding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      siteName,
      siteDescription,
      logo,
      favicon,
      primaryColor,
      secondaryColor,
      accentColor,
    } = req.body;

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const data: any = {};
    if (siteName !== undefined) data.siteName = siteName;
    if (siteDescription !== undefined) data.siteDescription = siteDescription;
    if (logo !== undefined) data.logo = logo;
    if (favicon !== undefined) data.favicon = favicon;
    if (primaryColor !== undefined) data.primaryColor = primaryColor;
    if (secondaryColor !== undefined) data.secondaryColor = secondaryColor;
    if (accentColor !== undefined) data.accentColor = accentColor;

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Branding updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/contact
export const updateContactInfo = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      email,
      phone,
      address,
      whatsapp,
      facebook,
      instagram,
      twitter,
      linkedin,
      contactEmail,
      contactPhone,
      contactAddress,
      contactWhatsapp,
    } = req.body;

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const data: any = {};
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (whatsapp !== undefined) data.whatsapp = whatsapp;
    if (facebook !== undefined) data.facebook = facebook;
    if (instagram !== undefined) data.instagram = instagram;
    if (twitter !== undefined) data.twitter = twitter;
    if (linkedin !== undefined) data.linkedin = linkedin;

    // Contact page specific
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    if (contactAddress !== undefined) data.contactAddress = contactAddress;
    if (contactWhatsapp !== undefined) data.contactWhatsapp = contactWhatsapp;

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Contact info updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/hero-slides
export const updateHeroSlides = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { heroSlides } = req.body;

    if (!Array.isArray(heroSlides)) {
      return res
        .status(400)
        .json({ success: false, message: "heroSlides must be an array" });
    }

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data: { heroSlides },
    });

    res.status(200).json({
      success: true,
      message: "Hero slides updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/hero-banners
export const updateHeroBanners = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { heroBanners } = req.body;

    if (!Array.isArray(heroBanners)) {
      return res
        .status(400)
        .json({ success: false, message: "heroBanners must be an array" });
    }

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data: { heroBanners },
    });

    res.status(200).json({
      success: true,
      message: "Hero banners updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/trust-badges
export const updateTrustBadges = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { trustBadges } = req.body;

    if (!Array.isArray(trustBadges)) {
      return res
        .status(400)
        .json({ success: false, message: "trustBadges must be an array" });
    }

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data: { trustBadges },
    });

    res.status(200).json({
      success: true,
      message: "Trust badges updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/about-us
export const updateAboutUs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      aboutUsTitle,
      aboutUsContent,
      aboutUsImage,
      aboutUsMission,
      aboutUsVision,
      aboutUsValues,
      aboutUsTeam,
      aboutUsStats,
    } = req.body;

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const data: any = {};
    if (aboutUsTitle !== undefined) data.aboutUsTitle = aboutUsTitle;
    if (aboutUsContent !== undefined) data.aboutUsContent = aboutUsContent;
    if (aboutUsImage !== undefined) data.aboutUsImage = aboutUsImage;
    if (aboutUsMission !== undefined) data.aboutUsMission = aboutUsMission;
    if (aboutUsVision !== undefined) data.aboutUsVision = aboutUsVision;
    if (aboutUsValues !== undefined) data.aboutUsValues = aboutUsValues;
    if (aboutUsTeam !== undefined) data.aboutUsTeam = aboutUsTeam;
    if (aboutUsStats !== undefined) data.aboutUsStats = aboutUsStats;

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "About Us page updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/contact-page
export const updateContactPage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      contactTitle,
      contactSubtitle,
      contactEmail,
      contactPhone,
      contactAddress,
      contactWhatsapp,
      contactMap,
      contactHours,
    } = req.body;

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const data: any = {};
    if (contactTitle !== undefined) data.contactTitle = contactTitle;
    if (contactSubtitle !== undefined) data.contactSubtitle = contactSubtitle;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    if (contactAddress !== undefined) data.contactAddress = contactAddress;
    if (contactWhatsapp !== undefined) data.contactWhatsapp = contactWhatsapp;
    if (contactMap !== undefined) data.contactMap = contactMap;
    if (contactHours !== undefined) data.contactHours = contactHours;

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Contact page updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/privacy
export const updatePrivacy = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { privacyTitle, privacyContent } = req.body;

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const data: any = {};
    if (privacyTitle !== undefined) data.privacyTitle = privacyTitle;
    if (privacyContent !== undefined) data.privacyContent = privacyContent;
    data.privacyLastUpdated = new Date();

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Privacy policy updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/settings/terms
export const updateTerms = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { termsTitle, termsContent } = req.body;

    let settings = await prisma.siteSetting.findFirst();
    if (!settings) settings = await prisma.siteSetting.create({ data: {} });

    const data: any = {};
    if (termsTitle !== undefined) data.termsTitle = termsTitle;
    if (termsContent !== undefined) data.termsContent = termsContent;
    data.termsLastUpdated = new Date();

    const updated = await prisma.siteSetting.update({
      where: { id: settings.id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Terms of service updated",
      data: { settings: updated },
    });
  } catch (error) {
    next(error);
  }
};
