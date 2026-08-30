import { inputStyle } from "./FormField.js";

// Plain text filter box shared by the list/catalog screens (Laudos, Cadastro,
// Tipos e opções de campo, Acessórios) — filtering itself stays local to each
// page (client-side, over the already-fetched list), this just standardizes
// the input's look.
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180, ...style }}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-gray)", pointerEvents: "none" }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingLeft: 36, width: "100%" }}
      />
    </div>
  );
}
