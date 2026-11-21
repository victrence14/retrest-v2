export function Toggle({
  on,
  onClick,
  label,
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? "on" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span />
    </button>
  );
}
