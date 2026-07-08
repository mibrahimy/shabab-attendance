"use client";

// Orchestrates the country/city list + the create flows. Server data comes in as
// a prop; after a mutation we router.refresh() to re-pull it.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { CredentialsDialog, type Credentials } from "@/components/ui/CredentialsDialog";
import { CreateCountryModal } from "./CreateCountryModal";
import { CreateCityModal } from "./CreateCityModal";

export type CityNode = { id: string; name: string };
export type CountryNode = { id: string; name: string; cities: CityNode[] };

export function CitiesManager({ countries }: { countries: CountryNode[] }) {
  const router = useRouter();
  const { t } = useTranslation("cities");
  const [countryModal, setCountryModal] = useState(false);
  const [cityForCountry, setCityForCountry] = useState<CountryNode | null>(null);
  const [provisioned, setProvisioned] = useState<Credentials | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">
            {t("page.eyebrow", "Administration")}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{t("page.title")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t("page.description")}</p>
        </div>
        <button
          onClick={() => setCountryModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2f55ea] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.1),0_4px_12px_rgba(47,85,234,0.25)] transition hover:bg-[#2848c8]"
        >
          {t("page.addCountry")}
        </button>
      </div>

      {countries.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
          action={<Button onClick={() => setCountryModal(true)}>{t("page.addCountry")}</Button>}
        />
      ) : (
        <div className="space-y-5">
          {countries.map((country) => (
            <div
              key={country.id}
              className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                    {country.name.charAt(0)}
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{country.name}</h2>
                    <p className="text-xs text-slate-400">
                      {country.cities.length} {country.cities.length === 1 ? "city" : "cities"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCityForCountry(country)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#2f55ea]/40 hover:text-[#2f55ea]"
                >
                  {t("country.addCity")}
                </button>
              </div>
              {country.cities.length === 0 ? (
                <p className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-400">
                  {t("country.noCities")}
                </p>
              ) : (
                <ul className="border-t border-slate-100">
                  {country.cities.map((city) => (
                    <li key={city.id} className="border-b border-slate-100 last:border-0">
                      <Link
                        href={`/hierarchy/${city.id}`}
                        className="group flex items-center justify-between px-5 py-3 transition hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-3">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#2f55ea]/10 text-[11px] font-bold text-[#2f55ea]">
                            {city.name.charAt(0)}
                          </span>
                          <span className="text-sm font-medium text-slate-900">{city.name}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-400 transition group-hover:text-[#2f55ea]">
                          {t("country.hierarchy")}
                          <span aria-hidden>→</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateCountryModal
        open={countryModal}
        onClose={() => setCountryModal(false)}
        onCreated={refresh}
      />
      <CreateCityModal
        country={cityForCountry}
        onClose={() => setCityForCountry(null)}
        onCreated={(admin) => {
          setCityForCountry(null);
          setProvisioned(admin);
          refresh();
        }}
      />
      <CredentialsDialog creds={provisioned} onClose={() => setProvisioned(null)} />
    </div>
  );
}
