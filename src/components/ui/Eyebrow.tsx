// Section eyebrow — a small royal-blue uppercase label with a short accent rule.
// A signature detail from the design mockups; use above section headers.

export default function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-3 w-0.5 rounded-full bg-[#2f55ea]" aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#2f55ea]">
        {children}
      </span>
    </div>
  );
}
