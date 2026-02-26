import { getSession } from "@/lib/auth";
import { logout } from "@/actions/auth";

export default async function TopBar() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200/80">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            A
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">Attendance</span>
        </div>

        <div className="hidden lg:block" />

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">{session?.name}</span>
          <form action={logout}>
            <button
              type="submit"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm text-gray-500 hover:text-gray-700 lg:min-h-0 lg:min-w-0 lg:px-3 lg:py-1.5 lg:rounded-lg lg:hover:bg-gray-100 transition-all duration-150 active:scale-95"
            >
              <svg className="w-5 h-5 lg:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
