'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, Bell, CalendarDays,
  MessageSquare, Activity, Settings, LogOut, ShieldCheck, Syringe, ChevronRight,
} from 'lucide-react';

const NAV = [
  { href: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/patients',     icon: Users,           label: 'Pacientes' },
  { href: '/appointments', icon: CalendarDays,    label: 'Consultas' },
  { href: '/alerts',       icon: Bell,            label: 'Alertas',   badge: 3 },
  { href: '/messages',     icon: MessageSquare,   label: 'Mensagens', badge: 2 },
  { href: '/evolution',    icon: Activity,        label: 'Evolução' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-gray-900 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
            <Syringe className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-[15px] leading-tight">GLP-1 Care Pro</p>
            <p className="text-gray-400 text-xs">Dashboard Clínico</p>
          </div>
        </div>
      </div>

      {/* Médico */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">DR</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">Dr. Rafael Costa</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-blue-400" />
              <p className="text-blue-300 text-xs truncate">Endocrinologista · CRM-SP 12345</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-gray-500 text-[11px] font-semibold uppercase tracking-wider">Menu Principal</p>
        {NAV.map(({ href, icon: Icon, label, badge }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group',
                active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white',
              )}>
              <Icon className={clsx('w-[18px] h-[18px] flex-shrink-0', active ? 'text-white' : 'text-gray-500 group-hover:text-white')} />
              <span className="flex-1 font-medium">{label}</span>
              {badge != null && (
                <span className={clsx('text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center', active ? 'bg-white/20 text-white' : 'bg-red-500 text-white')}>
                  {badge}
                </span>
              )}
              {active && <ChevronRight className="w-3.5 h-3.5 text-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all">
          <Settings className="w-[18px] h-[18px]" /><span className="font-medium">Configurações</span>
        </Link>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
          <LogOut className="w-[18px] h-[18px]" /><span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
