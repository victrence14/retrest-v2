/** Initials avatar; `index` picks one of four colour treatments. */
export function Avatar({
  name,
  index = 0,
  small = false,
}: {
  name: string;
  index?: number;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${index % 4} ${small ? "small" : ""}`}
      title={name}
    >
      {name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
