import type { BadgeColor } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
}

const colorStyles: Record<BadgeColor, string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  purple: "bg-purple-50 text-purple-700",
  indigo: "bg-indigo-50 text-indigo-700",
  orange: "bg-orange-50 text-orange-700",
  pink: "bg-pink-50 text-pink-700",
  slate: "bg-slate-100 text-slate-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-gray-100 text-gray-600",
};

export default function Badge({ children, color = "gray" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorStyles[color]}`}>
      {children}
    </span>
  );
}
