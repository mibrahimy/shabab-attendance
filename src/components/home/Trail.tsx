// The "trail" identity motif — attendance drawn as a comet's path of light. Each
// dot is a recent session (brighter = higher attendance); the glowing head is now.
// Pure SVG, no deps; the path draws in once and respects reduced motion (globals).

const GRAD = "trail-grad";

export function Trail({ points }: { points: number[] }) {
  const w = 320;
  const h = 84;
  const padX = 16;
  const padTop = 14;
  const padBot = 16;
  const clamp = (r: number) => Math.max(0, Math.min(100, r));
  const n = points.length;
  const xs = n > 1 ? points.map((_, i) => padX + (i * (w - 2 * padX)) / (n - 1)) : [w / 2];
  const amp = h - padTop - padBot;
  const ys = points.map((r) => padTop + amp - (clamp(r) / 100) * amp);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const hx = xs[xs.length - 1];
  const hy = ys[ys.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" role="img" aria-label="Recent attendance trail" preserveAspectRatio="none">
      <defs>
        <linearGradient id={GRAD} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2b27c2" />
          <stop offset="0.5" stopColor="#6f1f9e" />
          <stop offset="1" stopColor="#c41f6a" />
        </linearGradient>
      </defs>
      {n > 1 && (
        <path
          d={d}
          fill="none"
          stroke={`url(#${GRAD})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trail-draw"
        />
      )}
      {xs.map((x, i) => {
        const head = i === n - 1;
        return (
          <circle
            key={i}
            cx={x}
            cy={ys[i]}
            r={head ? 5 : 3.2}
            fill={head ? `url(#${GRAD})` : "#2f55ea"}
            fillOpacity={head ? 1 : 0.28 + 0.62 * (clamp(points[i]) / 100)}
          />
        );
      })}
      {/* head glow */}
      <circle cx={hx} cy={hy} r="9" fill={`url(#${GRAD})`} opacity="0.16" />
    </svg>
  );
}
