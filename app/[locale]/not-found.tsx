import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main>
      <section className="subhead">
        <div className="shell">
          <h1>{t("title")}</h1>
          <p className="subhead-meta">{t("body")}</p>
        </div>
      </section>
      <section className="shell" style={{ paddingTop: 32, paddingBottom: 96 }}>
        <Link className="crumb" href="/">
          ← {t("home")}
        </Link>
      </section>
    </main>
  );
}
