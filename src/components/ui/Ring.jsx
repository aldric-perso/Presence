export default function Ring({ pct, color, size = 132 }) {
  const r = (size / 132) * 56;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-pill-bg)" strokeWidth={14} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontFamily="Instrument Serif, serif"
        fontSize={size * 0.257}
        fill="var(--color-ink)"
      >
        {pct}%
      </text>
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        fontFamily="Instrument Sans, sans-serif"
        fontSize={10}
        fill="var(--color-muted)"
      >
        présence
      </text>
    </svg>
  );
}
