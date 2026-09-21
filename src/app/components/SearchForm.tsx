"use client";

import { useActionState, useState } from "react";
import { startScrapeAction, type ActionState } from "@/app/actions";
import { CATEGORY_GROUPS, CITIES, REGIONS } from "@/lib/taxonomy";

export function SearchForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(startScrapeAction, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState("");
  const [cities, setCities] = useState<Set<string>>(new Set());
  const [customCity, setCustomCity] = useState("");

  const cityOptions = CITIES[country] ?? [];
  const cityCount = cities.size + customCity.split(",").filter((c) => c.trim()).length;
  const searches = Math.max(cityCount, 1) * selected.size;

  const toggleCity = (city: string) =>
    setCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });

  const toggle = (labels: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      labels.forEach((l) => (on ? next.add(l) : next.delete(l)));
      return next;
    });

  return (
    <form action={action} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-3">
          <label className="label" htmlFor="country">Country</label>
          <select
            id="country"
            name="country"
            className="input"
            required
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setCities(new Set());
            }}
          >
            <option value="" disabled>Select a country…</option>
            {REGIONS.map((r) => (
              <optgroup key={r.name} label={`${r.flag} ${r.name}`}>
                {r.countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="maxResults">Max results / search</label>
          <input id="maxResults" name="maxResults" type="number" min={1} max={500} defaultValue={50} className="input" />
        </div>
      </div>

      {country && (
        <div>
          <div className="mb-1 flex items-center gap-3">
            <span className="label mb-0">Cities (recommended)</span>
            <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setCities(new Set(cityOptions))}>Select all</button>
            <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setCities(new Set())}>Clear</button>
            <span className="text-xs text-zinc-400">None selected = whole country (fewer, less local results)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {cityOptions.map((city) => {
              const on = cities.has(city);
              return (
                <label
                  key={city}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"}`}
                >
                  <input type="checkbox" name="city" value={city} checked={on} onChange={() => toggleCity(city)} className="sr-only" />
                  {city}
                </label>
              );
            })}
          </div>
          <input
            name="customCity"
            value={customCity}
            onChange={(e) => setCustomCity(e.target.value)}
            className="input mt-2 sm:w-1/2"
            placeholder="Other cities, comma-separated (e.g. Boulder, Santa Fe)"
          />
        </div>
      )}

      <div>
        <span className="label">Categories</span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_GROUPS.map((g) => {
            const labels = g.categories.map((c) => c.label);
            const all = labels.every((l) => selected.has(l));
            return (
              <fieldset key={g.name} className="rounded-lg border border-zinc-200 p-3">
                <legend className="px-1 text-sm font-medium">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={all} onChange={(e) => toggle(labels, e.target.checked)} />
                    {g.icon} {g.name}
                  </label>
                </legend>
                {g.categories.map((c) => (
                  <label key={c.label} className="flex items-center gap-2 py-0.5 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      name="category"
                      value={c.label}
                      checked={selected.has(c.label)}
                      onChange={(e) => toggle([c.label], e.target.checked)}
                    />
                    {c.label}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="withWebsite" defaultChecked /> Only businesses with a website (better email hit rate)
        </label>
        <button className="btn ml-auto" disabled={pending || selected.size === 0 || searches > 50}>
          {pending ? "Starting…" : `Find leads${searches ? ` (${searches} search${searches > 1 ? "es" : ""})` : ""}`}
        </button>
      </div>
      {searches > 50 && <p className="text-sm text-amber-700">{searches} searches (cities × categories) — max 50 at once. Pick fewer.</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </form>
  );
}
