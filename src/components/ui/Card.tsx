interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 lg:p-6 ${className}`}>
      {children}
    </div>
  );
}
