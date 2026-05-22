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
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${iconColor}`}>
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
        className="block bg-white rounded-lg border border-gray-200 p-4 lg:p-5 hover:border-gray-300 transition-colors duration-150"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 lg:p-5">
      {content}
    </div>
  );
}
