import { useEffect, useRef, useState } from "react";

const ROW_HEIGHT = 44;

function WheelPicker({
  label,
  values,
  value,
  format,
  onChange,
}: {
  label: string;
  values: number[];
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const wheel = useRef<HTMLDivElement>(null);
  const debounce = useRef<number | undefined>(undefined);
  const initialOffset = useRef(values.indexOf(value) * ROW_HEIGHT);

  useEffect(() => {
    const element = wheel.current;
    if (!element) return;
    element.scrollTop = initialOffset.current;
    return () => window.clearTimeout(debounce.current);
  }, []);

  const selectIndex = (index: number) => {
    const bounded = Math.min(values.length - 1, Math.max(0, index));
    onChange(values[bounded]);
    if (wheel.current) {
      if (typeof wheel.current.scrollTo === "function")
        wheel.current.scrollTo({
          top: bounded * ROW_HEIGHT,
          behavior: "auto",
        });
      else wheel.current.scrollTop = bounded * ROW_HEIGHT;
    }
  };

  return (
    <div className="picker-wheel-group">
      <p className="picker-wheel-label">{label}</p>
      <div className="picker-wheel-frame">
        <div
          ref={wheel}
          className="picker-wheel"
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={() => {
            window.clearTimeout(debounce.current);
            debounce.current = window.setTimeout(() => {
              const index = Math.round(
                (wheel.current?.scrollTop ?? 0) / ROW_HEIGHT,
              );
              const next =
                values[Math.min(values.length - 1, Math.max(0, index))];
              if (next !== undefined) onChange(next);
            }, 90);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const index =
              values.indexOf(value) + (event.key === "ArrowDown" ? 1 : -1);
            selectIndex(index);
          }}
        >
          <div className="picker-wheel-spacer" aria-hidden="true" />
          {values.map((option, index) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              tabIndex={option === value ? 0 : -1}
              className="picker-wheel-option"
              onClick={() => selectIndex(index)}
            >
              {format(option)}
            </button>
          ))}
          <div className="picker-wheel-spacer" aria-hidden="true" />
        </div>
        <span className="picker-selection" aria-hidden="true" />
        <span className="picker-fade picker-fade-top" aria-hidden="true" />
        <span className="picker-fade picker-fade-bottom" aria-hidden="true" />
      </div>
    </div>
  );
}

type PickerColumn = {
  label: string;
  values: number[];
  value: number;
  format?: (value: number) => string;
};

export function SetValuePicker({
  label,
  value,
  columns,
  disabled,
  formatValue,
  onSave,
}: {
  label: string;
  value: number | null;
  columns: PickerColumn[];
  disabled?: boolean;
  formatValue: (value: number | null) => string;
  onSave: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const closeTimeout = useRef<number | undefined>(undefined);
  const dialog = useRef<HTMLElement>(null);

  const closePicker = () => {
    if (closing) return;
    setOpen(false);
    setClosing(true);
    closeTimeout.current = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 180);
  };

  const showPicker = () => {
    window.clearTimeout(closeTimeout.current);
    setClosing(false);
    setSelection(columns.map((column) => column.value));
    setMounted(true);
    setOpen(true);
  };

  const save = () => {
    const value =
      columns.length === 2 ? selection[0] * 60 + selection[1] : selection[0];
    onSave(value);
    closePicker();
  };

  useEffect(() => () => window.clearTimeout(closeTimeout.current), []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLElement>("[role=listbox]")
        ?.focus({ preventScroll: true }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div className="set-field">
      <span>{label}</span>
      <button
        type="button"
        className="set-picker-trigger"
        aria-label={label}
        data-value={value ?? ""}
        disabled={disabled}
        onClick={showPicker}
      >
        <span>{formatValue(value)}</span>
        <span className="picker-trigger-chevron" aria-hidden="true">
          ⌃
        </span>
      </button>
      {mounted && (
        <div
          className={`modal picker-backdrop${closing ? " is-closing" : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
        >
          <section
            ref={dialog}
            className="picker-dialog"
            role="dialog"
            aria-hidden={closing}
            aria-modal="true"
            aria-label={`Choisir ${label}`}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closePicker();
              }
              if (event.key === "Tab") {
                const focusable = Array.from(
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    "[role=listbox], button",
                  ),
                );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <header className="picker-header">
              <div>
                <span>PARAMÈTRE DE SÉRIE</span>
                <h2>{label}</h2>
              </div>
              <button type="button" aria-label="Fermer" onClick={closePicker}>
                ×
              </button>
            </header>
            <div
              className={`picker-wheels${columns.length > 1 ? " picker-wheels-pair" : ""}`}
            >
              {columns.map((column, index) => (
                <WheelPicker
                  key={column.label}
                  label={column.label}
                  values={column.values}
                  value={selection[index] ?? column.value}
                  format={column.format ?? String}
                  onChange={(next) =>
                    setSelection((previous) =>
                      previous.map((current, i) =>
                        i === index ? next : current,
                      ),
                    )
                  }
                />
              ))}
            </div>
            <footer className="picker-actions">
              <button
                type="button"
                className="picker-cancel"
                onClick={closePicker}
              >
                Annuler
              </button>
              <button type="button" className="picker-save" onClick={save}>
                Valider
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
