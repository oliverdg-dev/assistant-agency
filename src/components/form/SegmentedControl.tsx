import { FieldMessage, fieldIds } from "../ui";

// A row of mutually exclusive choices built from real radio inputs, so it
// works with the keyboard (arrow keys) and screen readers out of the box.
export function SegmentedControl({
  id,
  name,
  legend,
  options,
  value,
  onChange,
  error,
  optional,
  columns = "sm:grid-cols-3",
}: {
  id: string;
  name: string;
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  optional?: boolean;
  columns?: string;
}) {
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-describedby={error ? fieldIds(id).error : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-2 text-[0.9375rem] font-medium text-ink">
        {legend}
        {optional && <span className="font-normal text-ink-subtle"> (optional)</span>}
      </legend>
      <div
        className={`grid grid-cols-2 gap-2 rounded-lg ${columns} ${
          error ? "outline outline-2 outline-offset-2 outline-error" : ""
        }`}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-[0.9375rem] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                checked
                  ? "border-brand bg-brand-tint text-ink"
                  : "border-line-strong bg-paper text-ink hover:border-ink-subtle"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      <FieldMessage id={id} error={error} />
    </fieldset>
  );
}
