import React, { useState } from 'react';
import { StrideLogo } from '../common/StrideLogo.tsx';
import { authApi, UnifiedUser, UserRole, DEMO_CREDENTIALS } from '../../api/authApi';
import { ShieldCheck, UserCheck, ArrowRight, Loader2, Sparkles, User as UserIcon, Phone, CreditCard, Radio } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UnifiedUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('CITIZEN');
  const [aadharNumber, setAadharNumber] = useState('5432 8901 2345');
  const [fullName, setFullName] = useState('Ramesh Iyer');
  const [mobileNumber, setMobileNumber] = useState('9800000011');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format Aadhaar with spaces (xxxx xxxx xxxx) as user types
  const handleAadharChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setAadharNumber(formatted);
  };

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(raw);
  };

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
    const cred = DEMO_CREDENTIALS[role];
    if (role === 'CITIZEN') {
      setAadharNumber(cred.identityBadge);
      setFullName(cred.name);
      setMobileNumber(cred.beforeMobile);
    } else if (role === 'AUTHORITY') {
      setAadharNumber(cred.identityBadge);
      setFullName(cred.name);
      setMobileNumber(cred.beforeMobile);
    } else {
      setAadharNumber(cred.identityBadge);
      setFullName(cred.name);
      setMobileNumber(cred.beforeMobile);
    }
  };

  const handleQuickDemoLogin = async (role: UserRole) => {
    setLoading(true);
    setError(null);
    try {
      const user = await authApi.loginDemo(role);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = aadharNumber.replace(/\s+/g, '').trim();
    const cleanPhone = mobileNumber.replace(/\s+/g, '').trim();
    const cleanName = fullName.trim();

    if (!cleanId) {
      setError(selectedRole === 'CITIZEN' ? 'Please enter your 12-digit Aadhaar number.' : 'Please enter your Service/Badge ID.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await authApi.loginCustom({
        identifier: cleanPhone,
        name: cleanName,
        role: selectedRole,
      });
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-hidden bg-[#F5EFEB]">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#C8D9E6]/30 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] rounded-full bg-[#567C8D]/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-80 h-80 rounded-full bg-[#C8D9E6]/25 blur-2xl" />

        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sensorGrid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#567C8D" strokeWidth="0.75" strokeDasharray="4 4" />
              <circle cx="80" cy="80" r="1.5" fill="#567C8D" opacity="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sensorGrid)" />
        </svg>
      </div>

      {/* Top Header with STRIDE Branding */}
      <header className="relative z-10 p-6 md:p-8 flex items-center justify-between">
        <StrideLogo size="md" showSubtitle={true} />
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-[#C8D9E6]/60 text-xs font-semibold text-[#567C8D] backdrop-blur-sm">
          <ShieldCheck className="w-4 h-4 text-[#567C8D]" />
          <span>Dual Phase Protocol: BEFORE (Preparedness) + DURING (Live SOS)</span>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-xl shadow-[#2F4156]/8 border border-[#C8D9E6]/60 p-7 sm:p-9 transition-all">
          {/* Header Typography */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] tracking-tight">
              Welcome to STRIDE
            </h1>
            <p className="text-sm font-medium text-[#567C8D] mt-1.5">
              Sensor Trend Intelligence for Detection & Evaluation
            </p>
          </div>

          {/* 3-Way Role Selector: CITIZEN, AUTHORITY, RESCUER */}
          <div className="grid grid-cols-3 gap-1 p-1.5 bg-[#F5EFEB] rounded-2xl text-xs font-bold mb-6">
            <button
              id="role-tab-citizen"
              type="button"
              onClick={() => handleSelectRole('CITIZEN')}
              className={`py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center ${
                selectedRole === 'CITIZEN'
                  ? 'bg-white text-[#2F4156] shadow-sm font-bold border border-[#C8D9E6]/60'
                  : 'text-[#567C8D] hover:text-[#2F4156]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Citizen</span>
            </button>
            <button
              id="role-tab-authority"
              type="button"
              onClick={() => handleSelectRole('AUTHORITY')}
              className={`py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center ${
                selectedRole === 'AUTHORITY'
                  ? 'bg-[#2F4156] text-white shadow-sm font-bold'
                  : 'text-[#567C8D] hover:text-[#2F4156]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Authority</span>
            </button>
            <button
              id="role-tab-rescuer"
              type="button"
              onClick={() => handleSelectRole('RESCUER')}
              className={`py-2 px-2 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer text-center ${
                selectedRole === 'RESCUER'
                  ? 'bg-[#DC2626] text-white shadow-sm font-bold'
                  : 'text-[#567C8D] hover:text-[#DC2626]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Rescuer</span>
            </button>
          </div>

          {/* Context Banner with Instant 1-Click Demo Login */}
          <div className="mb-5 p-3.5 rounded-2xl bg-[#F5EFEB]/70 border border-[#C8D9E6]/60 flex items-center justify-between gap-3">
            <div className="text-xs text-[#567C8D]">
              <span className="font-bold text-[#2F4156] block">
                {selectedRole === 'CITIZEN'
                  ? 'Citizen Portal (Census & SOS)'
                  : selectedRole === 'AUTHORITY'
                  ? 'Incident Command (Ranked Triage & Dispatch)'
                  : 'Rescuer Field Unit (Active Missions)'}
              </span>
              <span className="text-[11px]">Real backend seeded credentials ready</span>
            </div>
            <button
              id="btn-quick-demo-login"
              type="button"
              onClick={() => handleQuickDemoLogin(selectedRole)}
              disabled={loading}
              className="text-xs font-bold text-white bg-[#2F4156] hover:bg-[#1F2D3D] px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50"
              title="Click for instant 1-click login with seeded backend data"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C8D9E6]" />
              <span>Quick Demo</span>
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Input Form for Details */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: Aadhaar Number or Badge ID */}
            <div>
              <label
                htmlFor="citizen-aadhaar-input"
                className="block text-xs font-bold text-[#2F4156] mb-1.5 flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-[#567C8D]" />
                <span>
                  {selectedRole === 'CITIZEN'
                    ? 'Aadhaar / National ID'
                    : selectedRole === 'AUTHORITY'
                    ? 'Authority Badge / Dispatcher ID'
                    : 'Responder Badge / Squad ID'}
                </span>
              </label>
              <input
                id="citizen-aadhaar-input"
                type="text"
                value={aadharNumber}
                onChange={selectedRole === 'CITIZEN' ? handleAadharChange : (e) => setAadharNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#C8D9E6] focus:border-[#567C8D] focus:ring-2 focus:ring-[#567C8D]/20 outline-none text-sm font-medium text-[#2F4156] placeholder-[#567C8D]/50 bg-white transition"
                required
              />
            </div>

            {/* Field 2: Full Name */}
            <div>
              <label
                htmlFor="citizen-name-input"
                className="block text-xs font-bold text-[#2F4156] mb-1.5 flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#567C8D]" />
                <span>Full Name</span>
              </label>
              <input
                id="citizen-name-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#C8D9E6] focus:border-[#567C8D] focus:ring-2 focus:ring-[#567C8D]/20 outline-none text-sm font-medium text-[#2F4156] placeholder-[#567C8D]/50 bg-white transition"
                required
              />
            </div>

            {/* Field 3: Mobile / Contact */}
            <div>
              <label
                htmlFor="citizen-mobile-input"
                className="block text-xs font-bold text-[#2F4156] mb-1.5 flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-[#567C8D]" />
                <span>Mobile Number (10 digits)</span>
              </label>
              <input
                id="citizen-mobile-input"
                type="tel"
                value={mobileNumber}
                onChange={handleMobileChange}
                className="w-full px-4 py-2.5 rounded-xl border border-[#C8D9E6] focus:border-[#567C8D] focus:ring-2 focus:ring-[#567C8D]/20 outline-none text-sm font-medium text-[#2F4156] placeholder-[#567C8D]/50 bg-white transition"
                required
              />
            </div>

            {/* Primary Submit Button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-6 rounded-xl bg-[#2F4156] hover:bg-[#1F2D3D] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-[#2F4156]/15 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#C8D9E6]" />
                  <span>Connecting to Backends...</span>
                </>
              ) : (
                <>
                  <span>
                    {selectedRole === 'CITIZEN'
                      ? 'Enter Citizen Portal'
                      : selectedRole === 'AUTHORITY'
                      ? 'Enter Authority Command'
                      : 'Access Rescuer Field Command'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#C8D9E6]" />
                </>
              )}
            </button>
          </form>

          {/* Privacy Footnote */}
          <p className="text-center text-xs text-[#567C8D] mt-6 leading-relaxed">
            STRIDE connects to BEFORE (Port 4000) & DURING (Port 5000) backends securely.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-[#567C8D]/80">
        STRIDE Platform • Dual-Backend Disaster Response Architecture
      </footer>
    </div>
  );
};
