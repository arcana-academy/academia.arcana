import type { MetadataRoute } from "next";
import { isPersonalModeEnabled } from "@/lib/security/personal-access";

import {
  NON_CRAWLABLE_PREFIXES,
  listNonIndexableRoutes,
  resolveSiteUrl,
} from "@/lib/seo/site-metadata";

/**
 * Session-gated routes are excluded from crawling, and the sitemap advertises
 * only public routes. The origin is runtime configuration, so the file is
 * rendered per request.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (isPersonalModeEnabled()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const siteUrl = resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...listNonIndexableRoutes(), ...NON_CRAWLABLE_PREFIXES],
      },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl.origin,
  };
}
