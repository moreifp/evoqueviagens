export const MARKETING_ORIGIN = "https://evoque.global";
export const MARKETING_IMAGE = `${MARKETING_ORIGIN}/marketing/coast-editorial.webp`;

type MarketingHeadOptions = {
  title: string;
  description: string;
  path: string;
  alternatePath: string;
  locale: "pt_BR" | "en_US";
  noindex?: boolean;
  home?: boolean;
};

export function marketingHead({ title, description, path, alternatePath, locale, noindex = true, home = false }: MarketingHeadOptions) {
  const canonical = `${MARKETING_ORIGIN}${path}`;
  const ptPath = locale === "pt_BR" ? path : alternatePath;
  const enPath = locale === "en_US" ? path : alternatePath;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { httpEquiv: "content-language", content: locale === "pt_BR" ? "pt-BR" : "en" },
      { name: "robots", content: noindex ? "noindex, nofollow" : "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: MARKETING_IMAGE },
      { property: "og:locale", content: locale },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: MARKETING_IMAGE },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "alternate", hrefLang: "pt-BR", href: `${MARKETING_ORIGIN}${ptPath}` },
      { rel: "alternate", hrefLang: "en", href: `${MARKETING_ORIGIN}${enPath}` },
      { rel: "alternate", hrefLang: "x-default", href: `${MARKETING_ORIGIN}${ptPath}` },
    ],
    scripts: home ? [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: locale === "pt_BR" ? "Evoque Viagens" : "Evoque Travels",
        url: MARKETING_ORIGIN,
        description,
        applicationCategory: "TravelApplication",
        publisher: { "@type": "Organization", name: "DPM Tecnologia Ltda." },
      }),
    }] : undefined,
  };
}
