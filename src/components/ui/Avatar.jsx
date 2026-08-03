function initialsOf(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Avatar({ name, size = 36, tone = "neutral" }) {
  const bg = tone === "brand" ? "var(--color-green)" : "var(--color-pill-bg)";
  const color = tone === "brand" ? "#fff" : "var(--color-ink-soft)";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        background: bg,
        color,
        fontSize: size * 0.33,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

export { initialsOf };
