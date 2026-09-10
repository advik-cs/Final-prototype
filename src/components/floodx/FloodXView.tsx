import React, { useState } from 'react';
import { RefreshCw, Maximize2, Minimize2, Waves, ArrowLeft, ShieldAlert } from 'lucide-react';
import { FLOODX_EMBED_URL } from '../../api/config.ts';

interface FloodXViewProps {
  onReturnToMode: (mode: 'BEFORE' | 'DURING') => void;
}

export const FloodXView: React.FC<FloodXViewProps> = ({ onReturnToMode }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const embedUrl = FLOODX_EMBED_URL;

  const handleRefresh = () => {
    setLoading(true);
    setLoadError(false);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div
      className={`flex flex-col bg-[#F5EFEB]/40 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-white'
          : 'h-[calc(100vh-4rem)] w-full'
      }`}
    >
      {/* FLOODX Module Internal Topbar */}
      <div className="h-12 bg-white/95 backdrop-blur border-b border-[#C8D9E6]/70 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-black shadow-xs">
            <Waves className="w-4 h-4 text-blue-600 animate-pulse flex-shrink-0" />
            <span className="tracking-wide">FLOODX</span>
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[#567C8D]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Satellite SAR Analysis & Real-Time Incident Intelligence
          </span>
        </div>

        {/* Action Controls & Return Navigation */}
        <div className="flex items-center gap-2">
          {/* Quick return buttons */}
          <button
            type="button"
            onClick={() => onReturnToMode('DURING')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/70 transition cursor-pointer"
            title="Return to Live Emergency Command"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>DURING</span>
          </button>

          <button
            type="button"
            onClick={() => onReturnToMode('BEFORE')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#2F4156] bg-[#C8D9E6]/30 hover:bg-[#C8D9E6]/50 border border-[#C8D9E6] transition cursor-pointer"
            title="Return to Disaster Preparedness"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>BEFORE</span>
          </button>

          <div className="h-4 w-px bg-[#C8D9E6]/60 mx-0.5" />

          {/* Reload iframe */}
          <button
            type="button"
            id="btn-reload-floodx"
            onClick={handleRefresh}
            title="Reload FLOOD-X Interface"
            className="p-1.5 rounded-lg text-[#567C8D] hover:text-[#2F4156] hover:bg-[#F5EFEB] transition cursor-pointer text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden lg:inline font-semibold">Reload</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            type="button"
            id="btn-fullscreen-floodx"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Workspace'}
            className="p-1.5 rounded-lg text-[#567C8D] hover:text-[#2F4156] hover:bg-[#F5EFEB] transition cursor-pointer text-xs flex items-center gap-1"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline font-semibold">{isFullscreen ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {/* Embedded Iframe Container */}
      <div className="relative flex-1 w-full h-full bg-[#0B132B] overflow-hidden">
        {loading && !loadError && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20 animate-pulse">
              <Waves className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#2F4156] mb-1">Loading FLOOD-X Intelligence Engine...</h3>
            <p className="text-xs text-[#567C8D] max-w-sm">
              Embedding live radar observations, flood probability maps, and incident coordination interfaces.
            </p>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#2F4156] mb-1">Unable to Load FLOOD-X</h3>
            <p className="text-xs text-[#567C8D] max-w-md mb-4">
              The embedded FLOOD-X application at <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{embedUrl}</code> could not be reached. Ensure the FloodX frontend service is active.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        <iframe
          key={iframeKey}
          id="floodx-embedded-frame"
          src={embedUrl}
          title="FLOOD-X Disaster Intelligence Platform"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
          className="w-full h-full border-0 block"
          allow="geolocation; camera; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        />
      </div>
    </div>
  );
};
