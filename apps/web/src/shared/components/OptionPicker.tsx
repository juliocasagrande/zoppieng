import { useState } from "react";
import { inputStyle } from "./FormField.js";

export interface PickerOption {
  value: string;
  label: string;
  imageUrl?: string | null;
}

const OTHER_OPTION = "__other__";

// A grid of image-illustrated cards instead of a plain <select> — used for
// every field-wizard selection backed by a customizable catalog (device
// type, accessory, system type, support structure, environment condition),
// so the field technician has a picture to match against what they're
// looking at instead of guessing from a text label alone. Falls back to a
// plain placeholder tile when an option has no image. An optional "Outro"
// tile reveals a free-text input for cases outside the catalog.
export function OptionPicker({
  options,
  value,
  onChange,
  allowOther = true,
  loading,
}: {
  options: PickerOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  allowOther?: boolean;
  loading?: boolean;
}) {
  const [customMode, setCustomMode] = useState(() => !!value && !options.some((o) => o.value === value));

  if (loading) {
    return <div className="zp-eyebrow">Carregando opções…</div>;
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
        {options.map((opt) => {
          const active = !customMode && value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setCustomMode(false);
                onChange(opt.value);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: 8,
                borderRadius: "var(--radius)",
                border: `2px solid ${active ? "var(--color-orange)" : "var(--color-gray-light)"}`,
                background: active ? "rgba(232,96,32,0.06)" : "var(--color-white)",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 64,
                  borderRadius: 4,
                  overflow: "hidden",
                  background: "var(--color-off-white)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {opt.imageUrl ? (
                  <img src={opt.imageUrl} alt={opt.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "1.4rem", color: "var(--color-gray)" }}>🖼️</span>
                )}
              </div>
              <span style={{ fontSize: "0.74rem", fontWeight: 600, lineHeight: 1.25, color: active ? "var(--color-orange)" : "var(--color-text)" }}>{opt.label}</span>
            </button>
          );
        })}

        {allowOther && (
          <button
            type="button"
            onClick={() => {
              setCustomMode(true);
              onChange("");
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 8,
              minHeight: 64 + 16 + 20,
              borderRadius: "var(--radius)",
              border: `2px dashed ${customMode ? "var(--color-orange)" : "var(--color-gray-light)"}`,
              background: customMode ? "rgba(232,96,32,0.06)" : "var(--color-white)",
              cursor: "pointer",
              textAlign: "center",
              color: customMode ? "var(--color-orange)" : "var(--color-gray)",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>+</span>
            <span style={{ fontSize: "0.74rem", fontWeight: 600 }}>Outro</span>
          </button>
        )}
      </div>

      {customMode && (
        <input
          style={{ ...inputStyle, marginTop: 8 }}
          placeholder="Especifique…"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}
