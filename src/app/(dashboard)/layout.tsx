import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { ToastProvider } from "@/components/ui/Toast";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const userRoles = session?.roles ?? "teacher";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar userRoles={userRoles} />
      <div className="lg:pl-60">
        <TopBar />
        <main className="p-4 lg:p-6 pb-20 lg:pb-6">
          <ToastProvider>
            <Breadcrumbs />
            {children}
          </ToastProvider>
        </main>
      </div>
      <BottomNav userRoles={userRoles} />
    </div>
  );
}
