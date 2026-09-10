import React, { useState, useEffect } from 'react';
import { User } from '../../services/authService.ts';
import { DisasterEvent } from '../../services/disasterService.ts';
import {
  ShieldCheck,
  Droplets,
  UtensilsCrossed,
  Cross,
  Flashlight,
  BatteryCharging,
  FileCheck,
  PhoneCall,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  Wind,
  Thermometer,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  Clock,
} from 'lucide-react';

interface EssentialsViewProps {
  user: User;
  activeDisaster: DisasterEvent | null;
}

interface HourlyForecast {
  time: string;
  temp: number;
  precipProb: number;
  weatherCode: number;
}

interface LiveWeatherData {
  temperature: number;
  apparentTemperature: number;
  windSpeed: number;
  precipitation: number;
  relativeHumidity: number;
  weatherCode: number;
  time: string;
  hourly: HourlyForecast[];
}

const CHECKLIST_ITEMS = [
  {
    id: 'clean_water',
    title: 'Clean Drinking Water',
    subtitle: '4 Liters / person / day for 3 days minimum',
    icon: Droplets,
  },
  {
    id: 'dry_food',
    title: 'Non-perishable ready-to-eat dry food & energy bars',
    subtitle: 'Ready-to-eat cans, nuts, high-calorie nutrition bars, infant formula',
    icon: UtensilsCrossed,
  },
  {
    id: 'first_aid_meds',
    title: 'Comprehensive First-Aid Kit & Prescription Medicines',
    subtitle: '(Insulin, BP, Inhalers) + sterile bandages, antiseptics & 7-day essential prescriptions',
    icon: Cross,
  },
  {
    id: 'flashlight_torch',
    title: 'Waterproof LED Flashlight & high-lumen backup torches',
    subtitle: 'Extra fresh batteries, headlamps, and chemical glow-sticks',
    icon: Flashlight,
  },
  {
    id: 'power_banks_radio',
    title: 'Charged 20,000mAh Power Banks & battery-operated emergency radio',
    subtitle: 'Dedicated power banks, USB cables, and AM/FM receiver for disaster advisories',
    icon: BatteryCharging,
  },
  {
    id: 'waterproof_docs',
    title: 'Sealed waterproof zip-pouch with IDs, property deeds & insurance docs',
    subtitle: 'Aadhaar, passports, property records, health policies, and emergency cash',
    icon: FileCheck,
  },
  {
    id: 'contacts_whistle',
    title: 'Emergency contacts list printed on laminated paper + loud distress whistle',
    subtitle: 'Laminated local emergency phone numbers + high-decibel acoustic rescue whistle',
    icon: PhoneCall,
  },
];

function getWmoDetails(code: number): { label: string; icon: React.ComponentType<{ className?: string }>; color: string } {
  switch (code) {
    case 0:
      return { label: 'Clear Sky', icon: Sun, color: 'text-amber-500' };
    case 1:
      return { label: 'Mainly Clear', icon: Sun, color: 'text-amber-500' };
    case 2:
      return { label: 'Partly Cloudy', icon: CloudSun, color: 'text-sky-500' };
    case 3:
      return { label: 'Overcast', icon: Cloud, color: 'text-slate-500' };
    case 45:
    case 48:
      return { label: 'Fog / Haze', icon: Cloud, color: 'text-slate-400' };
    case 51:
    case 53:
    case 55:
      return { label: 'Light Drizzle', icon: CloudDrizzle, color: 'text-blue-400' };
    case 61:
    case 63:
    case 65:
      return { label: 'Rain', icon: CloudRain, color: 'text-blue-600' };
    case 71:
    case 73:
    case 75:
      return { label: 'Snowfall', icon: CloudSnow, color: 'text-indigo-400' };
    case 80:
    case 81:
    case 82:
      return { label: 'Rain Showers', icon: CloudRain, color: 'text-blue-700' };
    case 95:
    case 96:
    case 99:
      return { label: 'Thunderstorm', icon: CloudLightning, color: 'text-purple-600' };
    default:
      return { label: 'Partly Cloudy', icon: CloudSun, color: 'text-sky-500' };
  }
}

export const EssentialsView: React.FC<EssentialsViewProps> = ({ user }) => {
  // Geolocation & Weather States
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'detected' | 'denied' | 'unavailable'>('detecting');
  const [isFallbackCoords, setIsFallbackCoords] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<LiveWeatherData | null>(null);

  // Checklist state scoped to authenticated citizen
  const storageKey = `stride_essentials_${user.id}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Detect location on mount
  useEffect(() => {
    detectLocationAndFetchWeather();
  }, []);

  // Save checklist to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(checkedItems));
    } catch {
      // Non-blocking
    }
  }, [checkedItems, storageKey]);

  const detectLocationAndFetchWeather = () => {
    setLocationStatus('detecting');
    setWeatherLoading(true);
    setWeatherError(null);

    if (!navigator.geolocation) {
      useFallbackLocation('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const detectedLat = Number(position.coords.latitude.toFixed(4));
        const detectedLon = Number(position.coords.longitude.toFixed(4));
        setCoords({ lat: detectedLat, lon: detectedLon });
        setIsFallbackCoords(false);
        setLocationStatus('detected');
        fetchLiveWeather(detectedLat, detectedLon);
      },
      (error) => {
        const reason = error.code === 1 ? 'denied' : 'unavailable';
        useFallbackLocation(reason);
      },
      { timeout: 9000, maximumAge: 300000, enableHighAccuracy: false }
    );
  };

  const useFallbackLocation = (status: 'denied' | 'unavailable') => {
    const fallbackLat = 12.9716;
    const fallbackLon = 77.5946;
    setCoords({ lat: fallbackLat, lon: fallbackLon });
    setIsFallbackCoords(true);
    setLocationStatus(status);
    fetchLiveWeather(fallbackLat, fallbackLon);
  };

  const fetchLiveWeather = async (lat: number, lon: number) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=6&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Weather service returned HTTP ${res.status}`);
      }
      const data = await res.json();

      const current = data.current || {};
      const hourly = data.hourly || {};

      const nextHours: HourlyForecast[] = [];
      const times = hourly.time || [];
      const temps = hourly.temperature_2m || [];
      const pops = hourly.precipitation_probability || [];
      const codes = hourly.weather_code || [];

      for (let i = 0; i < Math.min(6, times.length); i++) {
        nextHours.push({
          time: times[i],
          temp: temps[i] ?? current.temperature_2m ?? 0,
          precipProb: pops[i] ?? 0,
          weatherCode: codes[i] ?? current.weather_code ?? 0,
        });
      }

      setWeatherData({
        temperature: current.temperature_2m ?? 0,
        apparentTemperature: current.apparent_temperature ?? current.temperature_2m ?? 0,
        windSpeed: current.wind_speed_10m ?? 0,
        precipitation: current.precipitation ?? 0,
        relativeHumidity: current.relative_humidity_2m ?? 0,
        weatherCode: current.weather_code ?? 0,
        time: current.time || new Date().toISOString(),
        hourly: nextHours,
      });
    } catch (err: any) {
      console.error('Failed to load weather data:', err);
      setWeatherError(err.message || 'Unable to retrieve live meteorological data.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const toggleCheckItem = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAll = () => {
    const all: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach((item) => {
      all[item.id] = true;
    });
    setCheckedItems(all);
  };

  const handleResetChecklist = () => {
    if (confirm('Reset all checklist items to incomplete?')) {
      setCheckedItems({});
    }
  };

  const completedCount = CHECKLIST_ITEMS.filter((item) => checkedItems[item.id]).length;
  const progressPercent = Math.round((completedCount / CHECKLIST_ITEMS.length) * 100);

  const currentWeatherDetails = weatherData ? getWmoDetails(weatherData.weatherCode) : null;
  const WeatherIconComponent = currentWeatherDetails ? currentWeatherDetails.icon : Sun;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* SECTION HEADER */}
      <div>
        <div className="flex items-center gap-2 text-xs font-bold text-[#567C8D] uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-[#2F4156]" />
          <span>Preparedness & Resilience Hub</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] mt-1">
          Household Essentials & Live Atmospheric Intelligence
        </h1>
        <p className="text-sm text-[#567C8D] mt-1">
          Monitor real-time hyper-local weather conditions at your detected location and verify physical preparedness supplies before evacuation or isolation.
        </p>
      </div>

      {/* 1. LIVE WEATHER CARD */}
      <div className="rounded-3xl bg-white border border-[#C8D9E6]/80 shadow-sm overflow-hidden transition duration-200">
        {/* Weather Card Header */}
        <div className="p-5 sm:p-6 border-b border-[#F5EFEB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F5EFEB] text-[#2F4156] flex items-center justify-center flex-shrink-0">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156]">
                Live Weather Intelligence
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#567C8D]" />
                <span className="text-xs font-medium text-[#567C8D]">
                  {locationStatus === 'detecting' && 'Detecting your coordinates via GPS...'}
                  {locationStatus === 'detected' && coords && (
                    <span className="text-emerald-700 font-semibold">
                      Live GPS: {coords.lat.toFixed(4)}° N, {coords.lon.toFixed(4)}° E
                    </span>
                  )}
                  {locationStatus === 'denied' && (
                    <span className="text-amber-700 font-semibold">
                      GPS Permission Denied — Showing Bengaluru Fallback (12.9716° N, 77.5946° E)
                    </span>
                  )}
                  {locationStatus === 'unavailable' && (
                    <span className="text-amber-700 font-semibold">
                      GPS Unavailable — Showing Bengaluru Fallback (12.9716° N, 77.5946° E)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={detectLocationAndFetchWeather}
            disabled={weatherLoading}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-[#C8D9E6] text-xs font-bold text-[#2F4156] hover:bg-[#F5EFEB] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
            <span>Redetect Location & Refresh</span>
          </button>
        </div>

        {/* Location Notice Banner if fallback used */}
        {isFallbackCoords && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              {locationStatus === 'denied'
                ? 'Location permission was denied in your browser. Weather data is currently displayed for Bengaluru coordinates. Click "Redetect Location & Refresh" to grant permission.'
                : 'Geolocation service was unavailable on your device. Fallback coordinates for Bengaluru are active.'}
            </span>
          </div>
        )}

        {/* Weather Body */}
        <div className="p-6 sm:p-8">
          {weatherLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-[#567C8D]" />
              <p className="text-sm font-semibold text-[#2F4156]">
                Fetching live atmospheric telemetry from Open-Meteo...
              </p>
              <p className="text-xs text-[#567C8D]">
                Connecting to public global meteorological station network
              </p>
            </div>
          ) : weatherError ? (
            <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
              <h3 className="text-sm font-bold text-red-900">Weather Telemetry Unavailable</h3>
              <p className="text-xs text-red-700 max-w-md mx-auto">{weatherError}</p>
              <button
                type="button"
                onClick={() => coords && fetchLiveWeather(coords.lat, coords.lon)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition cursor-pointer"
              >
                Retry Weather Fetch
              </button>
            </div>
          ) : weatherData ? (
            <div className="space-y-6">
              {/* CURRENT CONDITIONS HERO */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {/* Temperature and Icon */}
                <div className="flex items-center gap-5 lg:border-r border-[#F5EFEB] lg:pr-6">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <WeatherIconComponent className={`w-11 h-11 ${currentWeatherDetails?.color || 'text-sky-500'}`} />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] tracking-tight">
                        {Math.round(weatherData.temperature)}°C
                      </span>
                    </div>
                    <p className="text-base font-bold text-[#2F4156] mt-0.5">
                      {currentWeatherDetails?.label || 'Clear'}
                    </p>
                    <span className="text-xs font-medium text-[#567C8D]">
                      Feels like {Math.round(weatherData.apparentTemperature)}°C
                    </span>
                  </div>
                </div>

                {/* 3 Metric Pills */}
                <div className="grid grid-cols-3 gap-3 lg:col-span-2">
                  <div className="p-4 rounded-2xl bg-[#F5EFEB]/70 border border-[#C8D9E6]/50 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 text-xs text-[#567C8D] font-semibold">
                      <Wind className="w-3.5 h-3.5 text-blue-600" />
                      <span>Wind Speed</span>
                    </div>
                    <span className="text-lg sm:text-xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] mt-1">
                      {weatherData.windSpeed} <span className="text-xs font-medium text-[#567C8D]">km/h</span>
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F5EFEB]/70 border border-[#C8D9E6]/50 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 text-xs text-[#567C8D] font-semibold">
                      <Droplets className="w-3.5 h-3.5 text-sky-600" />
                      <span>Precipitation</span>
                    </div>
                    <span className="text-lg sm:text-xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] mt-1">
                      {weatherData.precipitation} <span className="text-xs font-medium text-[#567C8D]">mm</span>
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F5EFEB]/70 border border-[#C8D9E6]/50 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 text-xs text-[#567C8D] font-semibold">
                      <Thermometer className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Humidity</span>
                    </div>
                    <span className="text-lg sm:text-xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] mt-1">
                      {weatherData.relativeHumidity} <span className="text-xs font-medium text-[#567C8D]">%</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* HOURLY FORECAST / TIMELINE */}
              <div className="pt-2 border-t border-[#F5EFEB]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#567C8D] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Hourly Timeline Forecast (Next 6 Hours)</span>
                  </span>
                  <span className="text-[11px] text-[#567C8D]">Open-Meteo Public API</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {weatherData.hourly.map((hour, idx) => {
                    const hourDetail = getWmoDetails(hour.weatherCode);
                    const HourIcon = hourDetail.icon;
                    let displayTime = hour.time;
                    try {
                      if (hour.time.includes('T')) {
                        displayTime = hour.time.split('T')[1].slice(0, 5);
                      }
                    } catch {
                      // fallback
                    }

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl text-center border transition ${
                          idx === 0
                            ? 'bg-blue-50/70 border-blue-200'
                            : 'bg-white border-[#C8D9E6]/60 hover:border-[#567C8D]/40'
                        }`}
                      >
                        <span className="text-xs font-bold text-[#2F4156] block">
                          {idx === 0 ? 'Now' : displayTime}
                        </span>
                        <div className="my-2 flex justify-center">
                          <HourIcon className={`w-6 h-6 ${hourDetail.color}`} />
                        </div>
                        <span className="text-sm font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] block">
                          {Math.round(hour.temp)}°C
                        </span>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-[#567C8D] mt-1">
                          <Droplets className="w-2.5 h-2.5 text-blue-500" />
                          <span>{hour.precipProb}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 2. EMERGENCY ESSENTIALS CHECKLIST */}
      <div className="rounded-3xl bg-white border border-[#C8D9E6]/80 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Checklist Header & Progress */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F5EFEB] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                Life Safety Kit
              </span>
              <span className="text-xs font-semibold text-[#567C8D]">
                Pre-Disaster Readiness
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156] mt-1.5">
              Emergency Essentials Checklist
            </h2>
            <p className="text-xs sm:text-sm text-[#567C8D] mt-1">
              Verify these 7 life-saving items are pre-packed and accessible before flooding or severe storm conditions worsen.
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="sm:text-right flex-shrink-0">
            <span className="text-xs font-bold text-[#567C8D] block uppercase tracking-wider">
              Preparedness Status
            </span>
            <span className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk',sans-serif] text-[#2F4156]">
              {completedCount} / {CHECKLIST_ITEMS.length}
            </span>
            <span className="text-xs font-bold text-emerald-600 block mt-0.5">
              {progressPercent}% essentials ready
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#F5EFEB] rounded-full h-3 overflow-hidden border border-[#C8D9E6]/60">
          <div
            className={`h-full transition-all duration-500 ${
              completedCount === CHECKLIST_ITEMS.length
                ? 'bg-emerald-500'
                : completedCount >= 4
                ? 'bg-sky-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Ready</span>
            </button>
            <span className="text-[#C8D9E6]">|</span>
            <button
              type="button"
              onClick={handleResetChecklist}
              className="text-xs font-bold text-[#567C8D] hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Checklist</span>
            </button>
          </div>

          <span className="text-[11px] text-[#567C8D]">
            Persisted for citizen account ({user.name || user.email})
          </span>
        </div>

        {/* Exactly 7 Checklist Items */}
        <div className="space-y-3 pt-2">
          {CHECKLIST_ITEMS.map((item, index) => {
            const isChecked = !!checkedItems[item.id];
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                onClick={() => toggleCheckItem(item.id)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start sm:items-center justify-between gap-4 ${
                  isChecked
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                    : 'bg-[#F5EFEB]/30 border-[#C8D9E6]/70 hover:border-[#567C8D]/60 hover:bg-white'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  {/* Item Number Badge & Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-[#C8D9E6] text-[#2F4156]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#567C8D]">
                        #{index + 1}
                      </span>
                      <h3
                        className={`text-sm sm:text-base font-bold transition ${
                          isChecked ? 'text-emerald-900 line-through opacity-85' : 'text-[#2F4156]'
                        }`}
                      >
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs text-[#567C8D] mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Checkbox */}
                <div className="flex-shrink-0 pt-0.5 sm:pt-0">
                  <div
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                      isChecked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-[#C8D9E6] bg-white hover:border-[#567C8D]'
                    }`}
                  >
                    {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 100% Prepared Banner */}
        {completedCount === CHECKLIST_ITEMS.length && (
          <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <span className="text-xs font-bold">
              All 7 Essential Readiness Supplies Verified! Your household is fully prepped for sudden weather isolation or evacuation orders.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
export default EssentialsView;
