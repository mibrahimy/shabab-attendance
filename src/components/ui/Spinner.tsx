// Small inline loading spinner, brand-colored. Used for page-level loading states.

export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-gray-400" role="status">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"
        />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
