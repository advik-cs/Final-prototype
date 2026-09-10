import React, { useState, useEffect } from 'react';
import { StrideLogo } from '../common/StrideLogo.tsx';
import { User } from '../../services/authService.ts';
import { notificationService, NotificationItem } from '../../services/notificationService.ts';
import { DisasterEvent, disasterService } from '../../services/disasterService.ts';
import {
  LayoutDashboard,
  Map as MapIcon,
  Users,
  Tent,
  CheckCircle2,
  Building2,
  AlertOctagon,
  LifeBuoy,
  Radio,
  Bell,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  Waves,
} from 'lucide-react';

export type DisasterMode = 'BEFORE' | 'DURING' | 'FLOODX';

export type BeforeTab =
  | 'dashboard'
  | 'essentials'
  | 'map'
  | 'household'
  | 'shelters'
  | 'reconfirmation'
  | 'occupancy'
  | 'threats';

export type DuringTab =
  | 'dashboard'
  | 'safe'
  | 'buildings'
  | 'maps'
  | 'rescue';

interface DashboardLayoutProps {
  user: User;
  mode: DisasterMode;
  onSwitchMode: (newMode: DisasterMode) => void;
  onLogout: () => void;
  activeBeforeTab: BeforeTab;
  onSelectBeforeTab: (tab: BeforeTab) => void;
  activeDuringTab: DuringTab;
  onSelectDuringTab: (tab: DuringTab) => void;
  onSwitchRole?: (newRole: 'CITIZEN' | 'AUTHORITY' | 'RESCUER') => void;
  activeDisaster: DisasterEvent | null;
  onSelectDisaster: (disaster: DisasterEvent) => void;
  disasters: DisasterEvent[];
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  mode,
  onSwitchMode,
  onLogout,
  activeBeforeTab,
  onSelectBeforeTab,
  activeDuringTab,
  onSelectDuringTab,
  onSwitchRole,
  activeDisaster,
  onSelectDisaster,
  disasters,
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch {
      // Non-blocking
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'READ' as const } : n))
      );
    } catch {
      // Non-blocking
    }
  };

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  const beforeNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(user.role === 'CITIZEN' ? [{ id: 'essentials', label: 'Essentials', icon: ShieldCheck }] : []),
    { id: 'map', label: 'Map', icon: MapIcon },
    ...(user.role !== 'AUTHORITY' ? [{ id: 'household', label: 'Household Members', icon: Users }] : []),
    { id: 'shelters', label: user.role === 'AUTHORITY' ? 'Shelter Information' : 'Shelter Selection', icon: Tent },
    ...(user.role !== 'AUTHORITY' ? [{ id: 'reconfirmation', label: 'Reconfirmation', icon: CheckCircle2 }] : []),
    { id: 'occupancy', label: 'Expected Occupancy', icon: Building2 },
    { id: 'threats', label: 'Predicted Threats', icon: AlertOctagon },
  ];

  const duringNavItems = [
    { id: 'dashboard', label: 'Dashboard / Community', icon: LayoutDashboard },
    { id: 'safe', label: 'Are You Safe?', icon: LifeBuoy },
    ...(user.role !== 'CITIZEN' ? [{ id: 'buildings', label: 'Buildings', icon: Building2 }] : []),
    { id: 'maps', label: 'Maps', icon: MapIcon },
    { id: 'rescue', label: 'Rescue Status', icon: Radio },
  ];

  return (
    <div className="min-h-screen flex bg-[#F5EFEB]">
      {/* ALWAYS-VISIBLE LEFT SIDEBAR (Not collapsed on desktop) */}
      <aside className="w-64 xl:w-72 bg-white border-r border-[#C8D9E6]/60 flex flex-col flex-shrink-0 z-30 sticky top-0 h-screen overflow-y-auto">
        {/* Sidebar Header with STRIDE Branding */}
        <div className="p-5 border-b border-[#F5EFEB]">
          <StrideLogo size="sm" showSubtitle={true} />
        </div>

        {/* Mode Selector Pill inside Sidebar */}
        <div className="p-4 border-b border-[#F5EFEB]">
          <div className="p-1 rounded-xl bg-[#F5EFEB] grid grid-cols-3 gap-1">
            <button
              id="sidebar-mode-before"
              type="button"
              onClick={() => onSwitchMode('BEFORE')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'BEFORE'
                  ? 'bg-white text-[#2F4156] shadow-sm'
                  : 'text-[#567C8D] hover:text-[#2F4156]'
              }`}
            >
              <span>BEFORE</span>
            </button>
            <button
              id="sidebar-mode-during"
              type="button"
              onClick={() => onSwitchMode('DURING')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'DURING'
                  ? 'bg-[#DC2626] text-white shadow-sm'
                  : 'text-[#567C8D] hover:text-[#DC2626]'
              }`}
            >
              <span>DURING</span>
            </button>
            <button
              id="sidebar-mode-floodx"
              type="button"
              onClick={() => onSwitchMode('FLOODX')}
              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'FLOODX'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              <span>FLOODX</span>
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-[#567C8D]">
            <span>Current Mode</span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold ${
                mode === 'BEFORE'
                  ? 'bg-[#C8D9E6]/40 text-[#2F4156]'
                  : mode === 'DURING'
                  ? 'bg-red-100 text-[#DC2626]'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {mode === 'BEFORE' ? 'Preparedness' : mode === 'DURING' ? 'Live Emergency' : 'Satellite AI'}
            </span>
          </div>
        </div>

        {/* Navigation Items based on mode */}
        <nav className="flex-1 p-3 space-y-1">
          <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#567C8D]">
            {mode === 'BEFORE'
              ? 'Before Disaster System'
              : 'During Disaster System'}
          </div>

          {mode === 'BEFORE' &&
            beforeNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeBeforeTab === item.id;
                const isThreats = item.id === 'threats';
                return (
                  <button
                    key={item.id}
                    id={`sidebar-nav-${item.id}`}
                    type="button"
                    onClick={() => onSelectBeforeTab(item.id as BeforeTab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isThreats
                        ? isActive
                          ? 'bg-red-700 hover:bg-red-800 text-white shadow-md ring-2 ring-red-300 font-bold'
                          : 'bg-red-600 hover:bg-red-700 text-white shadow-sm font-bold'
                        : isActive
                        ? 'bg-[#2F4156] text-white shadow-sm'
                        : 'text-[#2F4156] hover:bg-[#F5EFEB] hover:text-[#2F4156]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isThreats
                            ? 'text-white'
                            : isActive
                            ? 'text-[#C8D9E6]'
                            : 'text-[#567C8D]'
                        }`}
                      />
                      <span className={isThreats ? 'font-bold' : ''}>{item.label}</span>
                    </div>
                    {isThreats ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <ChevronRight className="w-3.5 h-3.5 text-white" />
                      </span>
                    ) : (
                      isActive && <ChevronRight className="w-3.5 h-3.5 text-[#C8D9E6]" />
                    )}
                  </button>
                );
              })}

          {mode === 'DURING' &&
            duringNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeDuringTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  type="button"
                  onClick={() => onSelectDuringTab(item.id as DuringTab)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#DC2626] text-white shadow-sm'
                      : 'text-[#2F4156] hover:bg-[#F5EFEB] hover:text-[#2F4156]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-white' : 'text-[#567C8D]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
                </button>
              );
            })}

          {mode === 'FLOODX' && (
            <div className="space-y-3 pt-1">
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs">
                <div className="flex items-center gap-1.5 text-blue-700 font-extrabold mb-1">
                  <Waves className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span>FLOOD-X System</span>
                </div>
                <p className="text-[11px] text-[#567C8D] leading-relaxed">
                  Sentinel-1 SAR radar imagery, automated drone flood detection, and AI situational reports.
                </p>
              </div>

              <div className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-[#567C8D]">
                Platform Navigation
              </div>
              <button
                type="button"
                id="sidebar-floodx-back-before"
                onClick={() => onSwitchMode('BEFORE')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-[#2F4156] hover:bg-[#F5EFEB] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-[#567C8D]" />
                  <span>Preparedness (BEFORE)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#567C8D]" />
              </button>
              <button
                type="button"
                id="sidebar-floodx-back-during"
                onClick={() => onSwitchMode('DURING')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-[#2F4156] hover:bg-[#F5EFEB] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#DC2626]" />
                  <span>Live Emergency (DURING)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#567C8D]" />
              </button>
            </div>
          )}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-[#F5EFEB] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#2F4156] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-[#2F4156] truncate">{user.name}</p>
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wider ${
                    user.role === 'AUTHORITY'
                      ? 'bg-[#2F4156] text-white'
                      : user.role === 'RESCUER'
                      ? 'bg-[#DC2626] text-white'
                      : 'bg-[#567C8D]/15 text-[#2F4156]'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <p className="text-[10px] text-[#567C8D] truncate">
                {user.role === 'CITIZEN' ? `Aadhaar: ${user.testIdentityNumber}` : `ID: ${user.testIdentityNumber}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-[#567C8D] hover:text-[#DC2626] hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white/95 backdrop-blur border-b border-[#C8D9E6]/60 px-6 flex items-center justify-between sticky top-0 z-20">
          {/* Active Disaster Selector / Indicator */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:inline text-xs font-bold text-[#567C8D] uppercase tracking-wide">
              Disaster Event:
            </span>
            {disasters.length > 0 ? (
              <div className="flex items-center gap-2 bg-[#F5EFEB] px-3 py-1.5 rounded-xl border border-[#C8D9E6]/70">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                <select
                  value={activeDisaster?.id || ''}
                  onChange={(e) => {
                    const found = disasters.find((d) => d.id === e.target.value);
                    if (found) onSelectDisaster(found);
                  }}
                  className="bg-transparent text-xs font-bold text-[#2F4156] outline-none cursor-pointer pr-2"
                >
                  {disasters.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{d.alertLevel}] {d.title}
                    </option>
                  ))}
                </select>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                    activeDisaster?.alertLevel === 'RED'
                      ? 'bg-red-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {activeDisaster?.alertLevel}
                </span>
              </div>
            ) : (
              <span className="text-xs text-[#567C8D]">No active disasters</span>
            )}
          </div>

          {/* Right Header Actions: Notification Bell + Quick Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-[#2F4156] hover:bg-[#F5EFEB] border border-transparent hover:border-[#C8D9E6] transition"
              >
                <Bell className="w-5 h-5 text-[#567C8D]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-[#C8D9E6] p-4 z-50">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F5EFEB]">
                    <span className="text-xs font-bold text-[#2F4156] uppercase tracking-wider">
                      Disaster Intelligence Alerts
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#567C8D]/10 text-[#567C8D]">
                      {unreadCount} New
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto mt-2 space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[#567C8D] text-center py-4">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-xl border text-xs transition ${
                            n.status === 'UNREAD'
                              ? 'bg-[#C8D9E6]/20 border-[#567C8D]/30 text-[#2F4156]'
                              : 'bg-white border-[#F5EFEB] text-[#567C8D]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[10px] uppercase text-[#567C8D]">
                              {n.type.replace('_', ' ')}
                            </span>
                            {n.status === 'UNREAD' && (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(n.id)}
                                className="text-[10px] text-[#567C8D] hover:text-[#2F4156] font-semibold underline"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          <p className="text-xs font-medium leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* FLOODX Navigation Button */}
            <button
              id="topbar-nav-floodx"
              type="button"
              onClick={() => onSwitchMode('FLOODX')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                mode === 'FLOODX'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm ring-2 ring-blue-300'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/90'
              }`}
              title="Open FLOOD-X Satellite Intelligence Module"
            >
              <Waves className={`w-3.5 h-3.5 ${mode === 'FLOODX' ? 'text-white' : 'text-blue-600'}`} />
              <span>FLOODX</span>
            </button>

            {/* Mode Switch Fast Button */}
            <button
              type="button"
              onClick={() => onSwitchMode(mode === 'BEFORE' ? 'DURING' : 'BEFORE')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C8D9E6] hover:bg-[#F5EFEB] text-xs font-bold text-[#2F4156] transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#567C8D]" />
              <span>{mode === 'FLOODX' ? 'Exit FLOODX' : `Switch to ${mode === 'BEFORE' ? 'DURING' : 'BEFORE'}`}</span>
            </button>
          </div>
        </header>

        {/* View Body */}
        <main
          className={`flex-1 overflow-x-hidden ${
            mode === 'FLOODX' ? 'p-0 overflow-hidden' : 'p-6 lg:p-8'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
