import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { filterRoleGroups, isExactRole } from "../../lib/bookingForm";
import { controlClass, describedBy, FieldMessage, fieldIds } from "../ui";

// Free-text role input with grouped suggestions (ARIA combobox + listbox).
// Suggestions are a convenience only: any role the visitor types is accepted.
export function RoleCombobox({
  id,
  value,
  onChange,
  error,
  initialCategory,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  initialCategory?: string;
  autoFocus?: boolean;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(Boolean(initialCategory));
  const [category, setCategory] = useState(initialCategory);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => filterRoleGroups(value, category), [value, category]);
  const options = useMemo(() => groups.flatMap((group) => group.roles), [groups]);
  const showList = open && options.length > 0;
  const hint = "Pick a suggestion or type your own.";
  const noMatch = value.trim().length > 1 && !isExactRole(value) && options.length === 0;

  const choose = (role: string) => {
    onChange(role);
    setOpen(false);
    setActive(-1);
    setCategory(undefined);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && showList && active >= 0) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  let flatIndex = -1;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-medium text-ink">
        Role
      </label>
      <p id={fieldIds(id).hint} className="mb-2 text-sm text-ink-subtle">
        {hint}
      </p>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name="role"
          type="text"
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-required="true"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, { hint, error })}
          placeholder="e.g. Executive Assistant"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setCategory(undefined);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={controlClass(Boolean(error))}
        />
        {showList && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Role suggestions"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-paper py-1 shadow-lg shadow-ink/5"
          >
            {groups.map((group) => (
              <li key={group.label} role="presentation">
                <p
                  role="presentation"
                  className="px-3.5 pb-1 pt-2.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
                >
                  {group.label}
                </p>
                <ul role="group" aria-label={group.label}>
                  {group.roles.map((role) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    const selected = index === active;
                    return (
                      <li
                        key={role}
                        id={optionId(index)}
                        role="option"
                        aria-selected={selected}
                        // mousedown keeps focus in the input so blur doesn't close the list first
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(role)}
                        onMouseMove={() => setActive(index)}
                        className={`cursor-pointer px-3.5 py-2 text-[0.9375rem] ${
                          selected ? "bg-brand-tint text-ink" : "text-ink"
                        }`}
                      >
                        {role}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      {noMatch && !error && (
        <p className="mt-2 text-sm text-ink-subtle">
          No exact match. We'll use “{value.trim()}”.
        </p>
      )}
      <FieldMessage id={id} error={error} />
    </div>
  );
}
