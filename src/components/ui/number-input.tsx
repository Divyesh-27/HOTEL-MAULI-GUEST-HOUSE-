import * as React from "react";

type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  /** Current numeric value from state. `''`, `null` or `undefined` render as an empty field. */
  value: number | string | null | undefined;
  /**
   * Called with the parsed number on each edit that forms a complete number.
   * When the field is cleared, it is called with `emptyValue` (default 0) while
   * the field itself stays visibly empty — nothing is forced into the box.
   */
  onValueChange: (value: number) => void;
  emptyValue?: number;
};

const toNumber = (v: NumberInputProps["value"]): number | undefined => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toText = (v: NumberInputProps["value"]): string => {
  const n = toNumber(v);
  return n === undefined ? "" : String(n);
};

/**
 * Drop-in replacement for a controlled `<input type="number">`.
 *
 * The visible text is kept as a local draft string, so partial input such as
 * "", "12." or "0.0" survives re-renders instead of being re-parsed and snapped
 * on every keystroke. The draft is only replaced when `value` changes from
 * outside (form reset, prefill, clamping in an onBlur handler, etc.).
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, emptyValue = 0, ...props }, ref) => {
    const [draft, setDraft] = React.useState(() => toText(value));
    // Last number we reported to the parent, so its echo doesn't overwrite the draft.
    const lastEmitted = React.useRef<number | undefined>(toNumber(value));

    React.useEffect(() => {
      const next = toNumber(value);
      if (Object.is(next, lastEmitted.current)) return;
      // Parent echoed the empty value back (e.g. `amount || ''`) while the field is empty.
      if (next === undefined && lastEmitted.current === emptyValue) return;
      lastEmitted.current = next;
      setDraft(toText(value));
    }, [value, emptyValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDraft(raw);

      let parsed: number;
      if (raw.trim() === "") {
        // Chromium reports "" for incomplete input like "1e"; don't treat that as cleared.
        if (e.target.validity.badInput) return;
        parsed = emptyValue;
      } else {
        parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
      }

      lastEmitted.current = parsed;
      onValueChange(parsed);
    };

    return <input {...props} ref={ref} type="number" value={draft} onChange={handleChange} />;
  },
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
