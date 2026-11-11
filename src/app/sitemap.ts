import type { MetadataRoute } from "next";
import { isPersonalModeEnabled } from "@/lib/security/personal-access";

import {
  listIndexableRoutes,
  resolveSiteUrl,
} from "@/lib/seo/site-metadata";

/**
 * The canonical origin depends on runtime configuration (Render host or the
 * public application URL), so the sitemap is rendered per request instead of
 * being frozen at build time.
 */
export const dynamic = "force-dynamic";

/** Public, crawlable routes only; authenticated surfaces never appear here. */
export default function sitemap(): MetadataRoute.Sitemap {
  // The personal site deliberately has no public routes to advertise.
  if (isPersonalModeEnabled()) return [];

  const siteUrl = resolveSiteUrl();

  return listIndexableRoutes().map((route) => ({
    url: new URL(route, siteUrl).toString(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
