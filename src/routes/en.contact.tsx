import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/MarketingPage";
import { marketingHead } from "@/lib/marketing-head";

export const Route = createFileRoute("/en/contact")({
  head: () =>
    marketingHead({
      title: "Let’s talk. | Evoque Travels",
      description: "Contact Evoque Travels by email at contato@evoque.global.",
      path: "/en/contact",
      alternatePath: "/contato",
      locale: "en_US",
      noindex: true,
      home: false,
    }),
  component: Page,
});

function Page() {
  return <MarketingPage page="contact-en" />;
}
