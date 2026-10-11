import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Link } from "./Link";

/*
 * Shared layout and control primitives. Pages compose these instead of
 * writing one-off Tailwind for buttons, sections and form fields, so spacing,
 * radius and focus states stay consistent. Usage notes live in DESIGN.md.
 */

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

type SectionTone = "plain" | "muted" | "paper" | "ink";

const SECTION_TONE: Record<SectionTone, string> = {
  plain: "bg-surface",
  muted: "bg-surface-2",
  paper: "bg-paper",
  ink: "bg-ink text-white",
};

export function Section({
  tone = "plain",
  className,
  children,
  ...rest
}: { tone?: SectionTone; className?: string; children: ReactNode } & Omit<
  ComponentProps<"section">,
  "className" | "children"
>) {
  return (
    <section className={cx("py-16 md:py-24", SECTION_TONE[tone], className)} {...rest}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeader({
  id,
  title,
  intro,
  className,
}: {
  id?: string;
  title: ReactNode;
  intro?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-10 max-w-2xl md:mb-12", className)}>
      <h2 id={id} className="text-[2rem] leading-tight md:text-[2.5rem]">
        {title}
      </h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-ink-muted">{intro}</p>}
    </div>
  );
}

// At most one per page, in the hero only (see DESIGN.md).
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm font-medium tracking-wide text-ink-muted">{children}</p>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "inverse-outline";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "border border-line-strong bg-paper text-ink hover:border-ink",
  ghost: "text-brand hover:underline",
  inverse: "bg-white text-ink hover:bg-surface-2",
  "inverse-outline": "border border-white/60 text-white hover:border-white hover:bg-white/10",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-11 px-5 text-[0.9375rem]",
  lg: "min-h-13 px-6 text-base",
};

export const buttonClass = ({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) =>
  cx(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    BUTTON_VARIANT[variant],
    variant !== "ghost" && BUTTON_SIZE[size],
    className,
  );

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...rest} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass({ variant, size, className })} {...rest} />;
}

export function TextLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx("font-semibold text-brand underline-offset-4 hover:underline", className)}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export const fieldIds = (id: string) => ({ hint: `${id}-hint`, error: `${id}-error` });

export const describedBy = (id: string, { hint, error }: { hint?: ReactNode; error?: string }) =>
  [hint ? fieldIds(id).hint : null, error ? fieldIds(id).error : null].filter(Boolean).join(" ") ||
  undefined;

export const controlClass = (hasError: boolean, className?: string) =>
  cx(
    "block w-full rounded-lg border bg-paper px-3.5 py-2.5 text-base text-ink",
    "placeholder:text-ink-subtle/80 transition-colors",
    "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
    hasError ? "border-error" : "border-line-strong hover:border-ink-subtle",
    className,
  );

export function FieldMessage({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={fieldIds(id).error} className="mt-2 flex items-start gap-1.5 text-sm text-error">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 flex-none fill-current">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 10.5h-1.5V10h1.5v1.5Zm0-3h-1.5v-4h1.5v4Z" />
      </svg>
      <span>{error}</span>
    </p>
  );
}

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-subtle"> (optional)</span>}
      </label>
      {hint && (
        <p id={fieldIds(id).hint} className="mb-2 text-sm text-ink-subtle">
          {hint}
        </p>
      )}
      {children}
      <FieldMessage id={id} error={error} />
    </div>
  );
}

// Top of every inner page: one h1 and a short intro.
export function PageHeader({ title, intro, children }: { title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-line bg-paper py-12 md:py-16">
      <Container>
        <h1 className="max-w-3xl text-[2.125rem] leading-tight xs:text-[2.5rem] md:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">{intro}</p>}
        {children}
      </Container>
    </section>
  );
}
