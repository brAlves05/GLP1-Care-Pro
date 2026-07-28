import { Sidebar } from '@/components/sidebar';
import { Bell, Search, ChevronDown } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-64">
        {/* Topbar */}
        <header className="flex-shrink-0 h-16 bg-white border-b border-gray-100 flex items-center gap-4 px-6 z-30">
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="search" placeholder="Buscar paciente, CID, medicamento..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button className="relative w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition">
              <Bell className="w-4 h-4 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <div className="w-px h-8 bg-gray-100" />
            <button className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-2 py-1.5 transition">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">DR</span>
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 leading-none">Dr. Rafael</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Endocrinologista</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
