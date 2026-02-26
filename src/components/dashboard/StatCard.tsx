import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  href?: string;
  iconColor?: string;
}

export default function StatCard({ label, value, icon, trend, href, iconColor = "text-gray-400 bg-gray-100" }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</div>
      {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 lg:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 lg:p-5">
      {content}
    </div>
  );
}
