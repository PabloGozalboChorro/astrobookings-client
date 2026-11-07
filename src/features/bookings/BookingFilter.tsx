import { useId, type ChangeEvent } from 'react';
import type { LaunchFilterOption } from './booking-filter';

const ALL_LAUNCHES_VALUE = '';

type BookingFilterProps = {
  options: readonly LaunchFilterOption[];
  selectedLaunchId: string | null;
  onChange: (launchId: string | null) => void;
};

export function BookingFilter({ options, selectedLaunchId, onChange }: BookingFilterProps) {
  const selectId = useId();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const { value } = event.target;
    onChange(value === ALL_LAUNCHES_VALUE ? null : value);
  }

  return (
    <div className="launch-filters">
      <div className="launch-filters__field">
        <label htmlFor={selectId}>Filtrar por lanzamiento</label>
        <select
          id={selectId}
          value={selectedLaunchId ?? ALL_LAUNCHES_VALUE}
          onChange={handleChange}
        >
          <option value={ALL_LAUNCHES_VALUE}>Todos los lanzamientos</option>
          {options.map((option) => (
            <option key={option.launchId} value={option.launchId}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
