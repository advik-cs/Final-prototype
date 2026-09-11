import React, { useState, useEffect } from 'react';
import { disasterService, BuildingIntelligence, DisasterEvent } from '../../services/disasterService.ts';
import { User } from '../../services/authService.ts';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Building2,
  Users,
  Home,
  Tent,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Loader2,
  Lock,
} from 'lucide-react';

interface ExpectedOccupancyViewProps {
  user: User;
  activeDisaster: DisasterEvent | null;
}

export const ExpectedOccupancyView: React.FC<ExpectedOccupancyViewProps> = ({
  user,
  activeDisaster,
}) => {
  const { t } = useLanguage();
  const [buildings, setBuildings] = useState<BuildingIntelligence[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'AFFECTED' | 'UNAFFECTED'>('ALL');

  useEffect(() => {
    loadBuildings();
  }, [activeDisaster?.id]);

  const loadBuildings = async () => {
    if (!activeDisaster) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const list = await disasterService.getBuildingIntelligence(activeDisaster.id);
      setBuildings(list);
    } catch (e: any) {
      console.error('Failed to load building intelligence:', e);
      setErrorMessage(e?.message || 'Failed to load building occupancy intelligence');
      setBuildings([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = buildings.filter((b) => {
    const matchesSearch =
      b.buildingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterRisk === 'AFFECTED') return b.isAffected;
    if (filterRisk === 'UNAFFECTED') return !b.isAffected;
    return true;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] tracking-tight">
            {t('shelters.occupancy')}
          </h1>
          <p className="text-sm font-medium text-[#567C8D] mt-1">
            Pre-disaster census intelligence. Expected occupancy counts{' '}
            <strong className="text-[#2F4156]">ONLY</strong> persons choosing to stay at Home.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#567C8D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search building / street..."
              className="pl-9 pr-4 py-2 rounded-xl bg-white border border-[#C8D9E6] text-xs font-semibold text-[#2F4156] outline-none placeholder-[#567C8D]/60 focus:border-[#567C8D]"
            />
          </div>

          {/* Risk Level Filter */}
          <div className="p-1 rounded-xl bg-white border border-[#C8D9E6] flex items-center text-xs font-semibold">
            {(['ALL', 'AFFECTED', 'UNAFFECTED'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterRisk(mode)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterRisk === mode
                    ? mode === 'AFFECTED'
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-[#2F4156] text-white font-bold'
                    : 'text-[#567C8D] hover:text-[#2F4156]'
                }`}
              >
                {mode === 'ALL' ? 'All Buildings' : mode === 'AFFECTED' ? 'In Danger Zone' : 'Safe Zone'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#C8D9E6]/60 p-12 text-center shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-[#2F4156] mb-4" />
          <h3 className="text-lg font-bold text-[#2F4156]">
            Loading Building Intelligence...
          </h3>
          <p className="text-sm font-medium text-[#567C8D] mt-1">
            Evaluating pre-disaster census and home occupancy plans
          </p>
        </div>
      )}

      {/* Error State */}
      {!loading && errorMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
            {errorMessage.toLowerCase().includes('authorized') || errorMessage.toLowerCase().includes('role') ? (
              <Lock className="w-7 h-7" />
            ) : (
              <AlertTriangle className="w-7 h-7" />
            )}
          </div>
          <h3 className="text-lg font-bold text-amber-900 mb-2">
            Access Restricted or Unavailable
          </h3>
          <p className="text-sm text-amber-800 font-medium mb-4">
            {errorMessage}
          </p>
          {(errorMessage.toLowerCase().includes('rescuer') || errorMessage.toLowerCase().includes('citizen')) && (
            <div className="text-xs text-amber-700 bg-amber-100/70 border border-amber-200 rounded-xl p-3 inline-block max-w-md text-left">
              💡 <strong>Role Notice:</strong> Building census intelligence is designated for Rescuer & Authority personnel. Use the <strong>Role Switcher</strong> at the top right of the dashboard to switch to <strong>RESCUER</strong> to view this live dataset.
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !errorMessage && filtered.length === 0 && (
        <div className="bg-white rounded-3xl border border-[#C8D9E6]/60 p-12 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#C8D9E6]/30 text-[#567C8D] flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#2F4156]">
            No building occupancy data available
          </h3>
          <p className="text-xs font-medium text-[#567C8D] mt-1">
            {searchQuery || filterRisk !== 'ALL'
              ? 'No buildings matched your current search query or risk filter. Try clearing your filters.'
              : 'No building census records found for the active disaster event.'}
          </p>
        </div>
      )}

      {/* Buildings Grid */}
      {!loading && !errorMessage && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((b, idx) => {
          return (
            <div
              key={idx}
              className={`bg-white rounded-3xl p-6 border shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                b.isAffected
                  ? 'border-red-300 ring-1 ring-red-200'
                  : 'border-[#C8D9E6]/70'
              }`}
            >
              <div>
                {/* Building Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        b.isAffected
                          ? 'bg-red-50 text-red-600'
                          : 'bg-[#C8D9E6]/30 text-[#2F4156]'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#2F4156] leading-tight">
                        {b.buildingName}
                      </h3>
                      <p className="text-xs text-[#567C8D] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span>{b.address}</span>
                      </p>
                    </div>
                  </div>

                  {b.isAffected ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-red-600 text-white flex-shrink-0 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      RED ZONE
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 flex-shrink-0 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      SAFE
                    </span>
                  )}
                </div>

                {/* PROMINENT EXPECTED OCCUPANCY NUMBER */}
                <div className="mt-6 p-5 rounded-2xl bg-[#F5EFEB]/90 border border-[#C8D9E6]/60 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#567C8D]">
                    Expected Occupancy (Staying at Home)
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <Home className="w-6 h-6 text-[#2F4156]" />
                    <span className="text-4xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156]">
                      {b.expectedOccupancy}
                    </span>
                    <span className="text-sm font-semibold text-[#567C8D]">
                      / {b.registeredPopulation} registered
                    </span>
                  </div>
                </div>

                {/* Population Demographics */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-[#C8D9E6]/40">
                    <span className="text-[10px] text-[#567C8D] font-bold uppercase">Adults</span>
                    <p className="font-bold text-[#2F4156] mt-0.5">{b.adults}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#C8D9E6]/40">
                    <span className="text-[10px] text-amber-700 font-bold uppercase">Children</span>
                    <p className="font-bold text-amber-900 mt-0.5">{b.children}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#C8D9E6]/40">
                    <span className="text-[10px] text-purple-700 font-bold uppercase">Elderly</span>
                    <p className="font-bold text-purple-900 mt-0.5">{b.elderly}</p>
                  </div>
                </div>

                {/* Location Plans Breakdown */}
                <div className="mt-4 space-y-1.5 text-xs text-[#567C8D]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Tent className="w-3.5 h-3.5 text-[#059669]" />
                      Shelter Evacuees:
                    </span>
                    <span className="font-bold text-[#059669]">{b.expectedShelter}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#567C8D]" />
                      Other City / Relatives:
                    </span>
                    <span className="font-bold text-[#2F4156]">{b.expectedElsewhere}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Unknown / Unconfirmed:
                    </span>
                    <span className="font-bold text-amber-700">{b.unknown}</span>
                  </div>
                </div>
              </div>

              {/* Footnote */}
              <div className="mt-6 pt-3 border-t border-[#F5EFEB] flex items-center justify-between text-[11px] text-[#567C8D]">
                <span>Zone: {b.zoneName}</span>
                <span className="font-bold text-[#2F4156]">
                  Risk: {b.riskLevel}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
