import { POLISH_REGIONS, VOIVODESHIPS } from "@/lib/poland-regions";

type RegionFieldsProps = {
  voivodeship: string;
  county: string;
  onVoivodeshipChange: (value: string) => void;
  onCountyChange: (value: string) => void;
  className?: string;
  allowEmpty?: boolean;
};

function labelRegion(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

export function RegionFields({
  voivodeship,
  county,
  onVoivodeshipChange,
  onCountyChange,
  className = "",
  allowEmpty = true
}: RegionFieldsProps) {
  const counties = voivodeship ? POLISH_REGIONS[voivodeship] || [] : [];
  const countyOptions = county && !counties.includes(county) ? [county, ...counties] : counties;

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <label>
        <span className="label">Województwo</span>
        <select
          className="field"
          value={voivodeship}
          onChange={(event) => {
            onVoivodeshipChange(event.target.value);
            onCountyChange("");
          }}
        >
          {allowEmpty ? <option value="">Wybierz województwo</option> : null}
          {VOIVODESHIPS.map((item) => (
            <option key={item} value={item}>
              {labelRegion(item)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="label">Powiat</span>
        <select
          className="field"
          value={county}
          onChange={(event) => onCountyChange(event.target.value)}
          disabled={!voivodeship}
        >
          <option value="">{voivodeship ? "Wybierz powiat" : "Najpierw województwo"}</option>
          {countyOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

