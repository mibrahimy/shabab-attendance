"use client";

// Orchestrates the country/city list + the create flows. Server data comes in as
// a prop; after a mutation we router.refresh() to re-pull it.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { CredentialsDialog, type Credentials } from "@/components/ui/CredentialsDialog";
import { CreateCountryModal } from "./CreateCountryModal";
import { CreateCityModal } from "./CreateCityModal";

export type CityNode = { id: string; name: string };
export type CountryNode = { id: string; name: string; cities: CityNode[] };

export function CitiesManager({ countries }: { countries: CountryNode[] }) {
  const router = useRouter();
  const [countryModal, setCountryModal] = useState(false);
  const [cityForCountry, setCityForCountry] = useState<CountryNode | null>(null);
  const [provisioned, setProvisioned] = useState<Credentials | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Countries & Cities</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create the top of the org tree. Adding a city provisions its admin.
          </p>
        </div>
        <Button onClick={() => setCountryModal(true)}>Add country</Button>
      </div>

      {countries.length === 0 ? (
        <EmptyState
          title="No countries yet"
          description="Add a country to begin building the organisation."
          action={<Button onClick={() => setCountryModal(true)}>Add country</Button>}
        />
      ) : (
        <div className="space-y-4">
          {countries.map((country) => (
            <div key={country.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{country.name}</h2>
                <Button size="sm" variant="secondary" onClick={() => setCityForCountry(country)}>
                  Add city
                </Button>
              </div>
              {country.cities.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No cities yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {country.cities.map((city) => (
                    <li key={city.id}>
                      <Link
                        href={`/hierarchy/${city.id}`}
                        className="flex items-center justify-between py-2 text-sm text-gray-700 hover:text-[#2f55ea]"
                      >
                        <span>{city.name}</span>
                        <span className="text-gray-400" aria-hidden>
                          Hierarchy ›
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
