import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Globe, ChevronDown } from 'lucide-react';
import { SupportedLanguage } from '../../i18n';

interface LanguageSelectorDropdownProps {
  isDark?: boolean;
  className?: string;
  id?: string;
}

export const LanguageSelectorDropdown: React.FC<LanguageSelectorDropdownProps> = ({
  isDark = false,
  className = '',
  id = 'language-selector-dropdown',
}) => {
  const { language, setLanguage, availableLanguages } = useLanguage();

  return (
    <div
      className={`relative inline-flex items-center rounded-xl transition-all shadow-xs ${
        isDark
          ? 'bg-[#1C2541]/90 border border-[#334155] text-slate-200 hover:border-blue-500/60'
          : 'bg-white/90 border border-[#C8D9E6]/90 text-[#2F4156] hover:border-[#567C8D]/70'
      } ${className}`}
    >
      <Globe
        className={`w-4 h-4 ml-2.5 mr-1.5 flex-shrink-0 pointer-events-none transition-colors ${
          isDark ? 'text-blue-400' : 'text-[#567C8D]'
        }`}
        aria-hidden="true"
      />
      <select
        id={id}
        aria-label="Select Language / भाषा चुनें"
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        className={`appearance-none bg-transparent pl-1 pr-7 py-1.5 text-xs font-bold outline-none cursor-pointer rounded-xl transition-colors ${
          isDark ? 'text-slate-100 bg-[#1C2541]' : 'text-[#2F4156] bg-white sm:bg-transparent'
        }`}
      >
        {availableLanguages.map((lang) => (
          <option
            key={lang.code}
            value={lang.code}
            className={isDark ? 'bg-[#0B132B] text-slate-100 py-1' : 'bg-white text-[#2F4156] py-1'}
          >
            {lang.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`w-3.5 h-3.5 mr-2 pointer-events-none absolute right-1 transition-colors ${
          isDark ? 'text-slate-400' : 'text-[#567C8D]'
        }`}
        aria-hidden="true"
      />
    </div>
  );
};
