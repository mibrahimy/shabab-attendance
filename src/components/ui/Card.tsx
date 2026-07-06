interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-[var(--sh-sm)] p-4 lg:p-6 ${className}`}>
      {children}
    </div>
  );
}
