/**
 * Skjemafelt for admin: samme oppmerking som resten av portalen
 * (`pt-field` med label), uten å gjenta den i hvert skjema.
 *
 * `scope` gjør id-en unik når samme skjema står flere ganger på siden
 * (ett per rad).
 */
type Base = { name: string; label: string; hint?: React.ReactNode; scope?: string };

const fieldId = (name: string, scope?: string) => (scope ? `${scope}-${name}` : name);

export function Input({
  name,
  label,
  hint,
  scope,
  ...props
}: Base & Omit<React.ComponentProps<'input'>, 'id' | 'name'>) {
  const id = fieldId(name, scope);
  return (
    <div className="pt-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} {...props} />
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Select({
  name,
  label,
  hint,
  scope,
  children,
  ...props
}: Base & Omit<React.ComponentProps<'select'>, 'id' | 'name'>) {
  const id = fieldId(name, scope);
  return (
    <div className="pt-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} {...props}>{children}</select>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Textarea({
  name,
  label,
  hint,
  scope,
  ...props
}: Base & Omit<React.ComponentProps<'textarea'>, 'id' | 'name'>) {
  const id = fieldId(name, scope);
  return (
    <div className="pt-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} {...props} />
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: React.ReactNode;
  defaultChecked?: boolean;
}) {
  return (
    <label className="pt-check">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

/** Skjulte felt som følger med skjemaet (id-er). */
export function Hidden({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/**
 * Søkefelt som sender `?q=` med GET. `keep` er andre parametre som skal
 * følge med (f.eks. valgt fane).
 */
export function SearchForm({
  action,
  q,
  placeholder,
  keep,
}: {
  action: string;
  q: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} method="get" role="search" className="pt-copy">
      {Object.entries(keep ?? {}).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <input
        className="pt-input"
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="submit" className="pt-btn pt-btn-ghost">Søk</button>
    </form>
  );
}
