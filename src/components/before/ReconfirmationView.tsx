import React, { useState, useEffect } from 'react';
import { disasterService, DisasterEvent } from '../../services/disasterService.ts';
import { householdService, Household } from '../../services/householdService.ts';
import { shelterService, ShelterOccupancy } from '../../services/shelterService.ts';
import { User } from '../../services/authService.ts';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Loader2,
  HelpCircle,
  X,
  MapPin,
  Tent,
  Home,
  Building,
} from 'lucide-react';

interface ReconfirmationViewProps {
  user: User;
  activeDisaster: DisasterEvent | null;
}

export const ReconfirmationView: React.FC<ReconfirmationViewProps> = ({
  user,
  activeDisaster,
}) => {
  const [statusData, setStatusData] = useState<any>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [shelters, setShelters] = useState<ShelterOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Change Location Modal state
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeLocationType, setChangeLocationType] = useState<'SHELTER' | 'HOME' | 'OTHER_CITY'>('SHELTER');
  const [selectedShelterId, setSelectedShelterId] = useState<string>('');
  const [destinationCity, setDestinationCity] = useState<string>('Mysuru');

  useEffect(() => {
    loadReconfirmation();
  }, [activeDisaster?.id, user.role]);

  const loadReconfirmation = async () => {
    if (!activeDisaster) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [res, hh, sList] = await Promise.all([
        disasterService.getReconfirmationStatus(activeDisaster.id, user.role).catch((err) => {
          console.error('Error fetching reconfirmation status:', err);
          return null;
        }),
        householdService.getMyHousehold().catch(() => null),
        shelterService.getShelterOccupancy(activeDisaster.id).catch(() => []),
      ]);

      setStatusData(res);
      setHousehold(hh);
      setShelters(sList);

      if (sList.length > 0 && !selectedShelterId) {
        setSelectedShelterId(sList[0].id);
      }
    } catch (e: any) {
      console.error('Error loading reconfirmation data:', e);
      setErrorMessage(e.message || 'Failed to load reconfirmation details.');
    } finally {
      setLoading(false);
    }
  };

  const getTargetMembers = () => {
    if (statusData?.members && Array.isArray(statusData.members) && statusData.members.length > 0) {
      return statusData.members;
    }
    if (household?.members && Array.isArray(household.members) && household.members.length > 0) {
      return household.members;
    }
    return [];
  };

  const handleChoice = async (
    choice: 'SAME_PLAN' | 'CHANGE_LOCATION' | 'NOT_SURE',
    options?: {
      expectedLocationType?: 'HOME' | 'SHELTER' | 'OTHER_CITY' | 'UNKNOWN';
      shelterId?: string | null;
      otherCity?: string | null;
    }
  ) => {
    if (!activeDisaster) return;

    // If CHANGE_LOCATION is clicked directly without options, open the selector modal
    if (choice === 'CHANGE_LOCATION' && !options) {
      setShowChangeModal(true);
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const members = getTargetMembers();
      if (members.length === 0) {
        throw new Error('No registered household members found to reconfirm.');
      }

      let items: any[] = [];

      if (choice === 'SAME_PLAN') {
        items = members.map((m: any) => ({
          householdMemberId: m.householdMemberId || m.id,
          action: 'SAME_PLAN',
        }));
      } else if (choice === 'NOT_SURE') {
        items = members.map((m: any) => ({
          householdMemberId: m.householdMemberId || m.id,
          action: 'NOT_SURE',
        }));
      } else if (choice === 'CHANGE_LOCATION') {
        const type = options?.expectedLocationType || 'SHELTER';
        items = members.map((m: any) => {
          const item: any = {
            householdMemberId: m.householdMemberId || m.id,
            action: 'CHANGE_LOCATION',
            expectedLocationType: type,
          };
          if (type === 'SHELTER') {
            item.shelterId = options?.shelterId || selectedShelterId || (shelters[0] ? shelters[0].id : null);
          } else if (type === 'OTHER_CITY') {
            item.otherCity = options?.otherCity || destinationCity || 'Mysuru';
          }
          return item;
        });
      }

      const res = await disasterService.submitReconfirmation(activeDisaster.id, {
        reconfirmations: items,
      });

      setMessage(res.message || 'Household location plan reconfirmed successfully.');
      setShowChangeModal(false);
      await loadReconfirmation();
    } catch (err: any) {
      const errText = err.message || 'Failed to submit reconfirmation.';
      setErrorMessage(errText);
      alert('Failed to submit reconfirmation: ' + errText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmChangeLocation = () => {
    handleChoice('CHANGE_LOCATION', {
      expectedLocationType: changeLocationType,
      shelterId: changeLocationType === 'SHELTER' ? selectedShelterId : null,
      otherCity: changeLocationType === 'OTHER_CITY' ? destinationCity : null,
    });
  };

  // Field mapping with backend contract
  const hoursRemaining =
    statusData?.hoursUntilPredictedStart ??
    statusData?.hoursUntilPredictedDisaster ??
    18;

  const isWindowActive =
    statusData?.isReconfirmationWindowOpen ??
    statusData?.isWindowActive ??
    true;

  const totalAffected =
    statusData?.summary?.totalAffectedMembers ??
    statusData?.summary?.totalExpected ??
    (household?.members?.length || 0);

  const confirmedCount = statusData?.summary?.confirmedSame ?? 0;
  const changedCount = statusData?.summary?.changed ?? 0;
  const uncertainCount = statusData?.summary?.uncertain ?? 0;
  const pendingCount = statusData?.summary?.pending ?? 0;
  const verifiedCount = confirmedCount + changedCount + uncertainCount;

  const verificationRate =
    totalAffected > 0
      ? Math.round((verifiedCount / totalAffected) * 100)
      : (statusData?.responseRatePercentage ?? 78);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] tracking-tight">
          30-Hour Location Reconfirmation
        </h1>
        <p className="text-sm font-medium text-[#567C8D] mt-1">
          Disaster trajectories shift. Validate your household's plan before the disaster onset window closes.
        </p>
      </div>

      {/* Countdown Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#C8D9E6] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#C8D9E6]/30 flex items-center justify-center text-[#2F4156] flex-shrink-0">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900">
                {isWindowActive ? 'Reconfirmation Window Active' : 'Window Pending'}
              </span>
              <span className="text-xs text-[#567C8D] font-semibold">
                Event: {activeDisaster?.title}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#2F4156] mt-1">
              {hoursRemaining} Hours Until Predicted Impact
            </h2>
            <p className="text-xs text-[#567C8D] mt-0.5">
              Target Time: {new Date(activeDisaster?.predictedStartTime || Date.now()).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="text-center md:text-right p-4 rounded-2xl bg-[#F5EFEB] border border-[#C8D9E6]/60">
          <span className="text-[10px] font-bold uppercase text-[#567C8D]">
            Community Verification Rate
          </span>
          <p className="text-2xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] mt-0.5">
            {verificationRate}%
          </p>
          <span className="text-[11px] text-[#567C8D]">
            {verifiedCount} of {totalAffected} Verified
          </span>
        </div>
      </div>

      {/* Success Notification */}
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Detailed Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Citizen Action Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#C8D9E6] shadow-sm">
        <div className="max-w-2xl">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#567C8D]/15 text-[#2F4156]">
            Household Plan Verification
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] mt-3">
            "Has your household's emergency plan changed?"
          </h2>
          <p className="text-xs text-[#567C8D] mt-2 leading-relaxed">
            Due to the predicted severity of the oncoming flash flood, low-lying ground floor areas
            may experience water logging. Please confirm if your family intends to remain with your
            recorded plan, evacuate to a designated shelter, or relocate to another city.
          </p>
        </div>

        {/* 3 Large Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {/* Option 1: Same Plan */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleChoice('SAME_PLAN')}
            className="group p-6 rounded-2xl bg-[#F5EFEB]/70 hover:bg-[#2F4156] border border-[#C8D9E6] hover:border-[#2F4156] text-left transition duration-200 flex flex-col justify-between shadow-sm cursor-pointer disabled:opacity-50"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-white/10 flex items-center justify-center text-[#2F4156] group-hover:text-white transition">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 group-hover:text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-[#2F4156] group-hover:text-white mt-4">
                Same Plan
              </h3>
              <p className="text-xs text-[#567C8D] group-hover:text-[#C8D9E6] mt-1">
                We are sticking to our recorded location.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[#C8D9E6]/50 group-hover:border-white/20 flex items-center justify-between text-xs font-bold text-[#2F4156] group-hover:text-white">
              <span>Confirm Same</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Option 2: Change Location */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleChoice('CHANGE_LOCATION')}
            className="group p-6 rounded-2xl bg-[#F5EFEB]/70 hover:bg-[#567C8D] border border-[#C8D9E6] hover:border-[#567C8D] text-left transition duration-200 flex flex-col justify-between shadow-sm cursor-pointer disabled:opacity-50"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-white/10 flex items-center justify-center text-[#567C8D] group-hover:text-white transition">
                <RotateCcw className="w-5 h-5 text-blue-600 group-hover:text-blue-300" />
              </div>
              <h3 className="text-sm font-bold text-[#2F4156] group-hover:text-white mt-4">
                Change Location
              </h3>
              <p className="text-xs text-[#567C8D] group-hover:text-[#C8D9E6] mt-1">
                We are moving to a safe shelter or higher ground.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[#C8D9E6]/50 group-hover:border-white/20 flex items-center justify-between text-xs font-bold text-[#2F4156] group-hover:text-white">
              <span>Update Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Option 3: Not Sure */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleChoice('NOT_SURE')}
            className="group p-6 rounded-2xl bg-[#F5EFEB]/70 hover:bg-amber-600 border border-[#C8D9E6] hover:border-amber-600 text-left transition duration-200 flex flex-col justify-between shadow-sm cursor-pointer disabled:opacity-50"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-white/10 flex items-center justify-center text-amber-600 group-hover:text-white transition">
                <HelpCircle className="w-5 h-5 text-amber-600 group-hover:text-amber-300" />
              </div>
              <h3 className="text-sm font-bold text-[#2F4156] group-hover:text-white mt-4">
                Not Sure
              </h3>
              <p className="text-xs text-[#567C8D] group-hover:text-amber-100 mt-1">
                Evaluating conditions as weather evolves.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-[#C8D9E6]/50 group-hover:border-white/20 flex items-center justify-between text-xs font-bold text-[#2F4156] group-hover:text-white">
              <span>Flag as Unsure</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>

      {/* Rescuer Analytics Breakdown */}
      {user.role === 'RESCUER' && statusData?.summary && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#C8D9E6] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156]">
              Rescuer Command Reconfirmation Summary
            </h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#2F4156] text-white">
              Tactical Feed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#F5EFEB] text-center">
              <span className="text-xs font-bold text-[#567C8D]">Same Plan</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {confirmedCount}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F5EFEB] text-center">
              <span className="text-xs font-bold text-[#567C8D]">Change Location</span>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {changedCount}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F5EFEB] text-center">
              <span className="text-xs font-bold text-[#567C8D]">Not Sure</span>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {uncertainCount}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#F5EFEB] text-center">
              <span className="text-xs font-bold text-[#567C8D]">Pending Response</span>
              <p className="text-2xl font-bold text-gray-700 mt-1">
                {pendingCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Change Location Modal */}
      {showChangeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-[#C8D9E6] shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5EFEB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#567C8D]/15 flex items-center justify-center text-[#2F4156]">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156]">
                  Change Evacuation Plan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeModal(false)}
                className="p-1.5 rounded-lg text-[#567C8D] hover:text-[#2F4156] hover:bg-[#F5EFEB] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <p className="text-xs text-[#567C8D]">
                Select the updated evacuation location for your entire household ({totalAffected} members):
              </p>

              {/* Destination Type Radio Buttons */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setChangeLocationType('SHELTER')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                    changeLocationType === 'SHELTER'
                      ? 'border-[#2F4156] bg-[#2F4156] text-white shadow-sm'
                      : 'border-[#C8D9E6] bg-[#F5EFEB]/50 text-[#2F4156] hover:border-[#567C8D]'
                  }`}
                >
                  <Tent className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Safe Shelter</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChangeLocationType('HOME')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                    changeLocationType === 'HOME'
                      ? 'border-[#2F4156] bg-[#2F4156] text-white shadow-sm'
                      : 'border-[#C8D9E6] bg-[#F5EFEB]/50 text-[#2F4156] hover:border-[#567C8D]'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Stay at Home</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChangeLocationType('OTHER_CITY')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                    changeLocationType === 'OTHER_CITY'
                      ? 'border-[#2F4156] bg-[#2F4156] text-white shadow-sm'
                      : 'border-[#C8D9E6] bg-[#F5EFEB]/50 text-[#2F4156] hover:border-[#567C8D]'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Other City</span>
                </button>
              </div>

              {/* Conditional Field: Shelter Dropdown */}
              {changeLocationType === 'SHELTER' && (
                <div>
                  <label className="block text-xs font-semibold text-[#2F4156] mb-1.5">
                    Select Designated Shelter
                  </label>
                  <select
                    value={selectedShelterId}
                    onChange={(e) => setSelectedShelterId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C8D9E6] text-xs font-medium text-[#2F4156] bg-white outline-none focus:border-[#2F4156]"
                  >
                    {shelters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Cap: {s.capacity}, Remaining: {s.remainingCapacity < 0 ? 'NIL' : s.remainingCapacity})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#567C8D] mt-1">
                    Designated facilities in Bengaluru with live saturation monitoring.
                  </p>
                </div>
              )}

              {/* Conditional Field: Other City input */}
              {changeLocationType === 'OTHER_CITY' && (
                <div>
                  <label className="block text-xs font-semibold text-[#2F4156] mb-1.5">
                    Destination City / Region
                  </label>
                  <input
                    type="text"
                    required
                    value={destinationCity}
                    onChange={(e) => setDestinationCity(e.target.value)}
                    placeholder="e.g. Mysuru, Tumakuru, Hosur"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#C8D9E6] text-xs font-medium text-[#2F4156] outline-none focus:border-[#2F4156]"
                  />
                  <p className="text-[10px] text-[#567C8D] mt-1">
                    Enter the name of the municipality or city where your family will stay.
                  </p>
                </div>
              )}

              {/* Home Notice */}
              {changeLocationType === 'HOME' && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  <span className="font-bold block mb-0.5">Staying at Registered Home:</span>
                  Please ensure first-floor or elevated living spaces are accessible if ground inundation occurs.
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#F5EFEB] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#567C8D] hover:text-[#2F4156] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting || (changeLocationType === 'SHELTER' && !selectedShelterId)}
                  onClick={handleConfirmChangeLocation}
                  className="px-5 py-2.5 rounded-xl bg-[#2F4156] hover:bg-[#1F2D3D] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Plan Change</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
