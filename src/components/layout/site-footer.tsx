import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground">
        <p>
          {siteConfig.name} is an information and data visualization project. It
          is not a medical diagnosis tool and does not provide medical advice.
          Reported data may be delayed, revised or incomplete; always refer to
          the original source and your local health authorities.
        </p>
        <p>
          <a
            href={siteConfig.repositoryUrl}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Source code
          </a>
        </p>
      </div>
    </footer>
  );
}
