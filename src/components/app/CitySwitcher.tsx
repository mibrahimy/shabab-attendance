"use client";

// Scopes the operational + admin views to a city. Superadmins get a dropdown of
// all cities; a city admin sees their single city as a static chip. The choice is
// stored in the `sb_city` cookie, which the server reads to resolve the current
// city (dashboard, hierarchy/roles links).

import { useRouter } from "next/navigation";

type City = { id: string; name: string };

function setCityCookie(id: string) {
  // 1 year, root path — read by getDefaultCityId on the server.
  document.cookie = `sb_city=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function CitySwitcher({ cities, currentId }: { cities: City[]; currentId: string | null }) {
  const router = useRouter();
  const current = cities.find((c) => c.id === currentId) ?? cities[0] ?? null;
  if (!current) return null;

  // Single city → static chip (no need for a control).
  if (cities.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-[#2f55ea]/10 text-[10px] font-bold text-[#2f55ea]">
          {current.name.charAt(0)}
        </span>
        <span className="truncate text-[13px] font-medium text-slate-900">{current.name}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-[#2f55ea]/10 text-[10px] font-bold text-[#2f55ea]">
          {current.name.charAt(0)}
        </span>
      </span>
      <select
        aria-label="Switch city"
        value={current.id}
        onChange={(e) => {
          setCityCookie(e.target.value);
          router.refresh();
        }}
        className="w-full appearance-none rounded-xl border border-slate-200/80 bg-white ps-10 pe-8 py-2 text-[13px] font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/15"
      >
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-slate-400" aria-hidden>
        ▾
      </span>
    </div>
  );
}
