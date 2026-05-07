// src/context/LanguageContext.jsx
// Lightweight translation context — no external library needed
import React, { createContext, useContext, useState, useCallback } from 'react';

// ── Translation dictionaries ────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {}, // English: key === value, so t(key) returns key itself

  ta: {
    // ── App shell ──
    'Search…': 'தேடு…',
    'Logout': 'வெளியேறு',
    'Language': 'மொழி',

    // ── Nav groups ──
    'Overview':          'மேலோட்டம்',
    'Planning':          'திட்டமிடல்',
    'HR & Admin':        'HR & நிர்வாகம்',
    'Procurement':       'கொள்முதல்',
    'Stores':            'கிடங்கு',
    'Subcontractors':    'துணை ஒப்பந்தக்காரர்கள்',
    'QS & Billing':      'QS & கட்டண நிர்வாகம்',
    'Finance':           'நிதி',
    'DQS Tracker':       'DQS கண்காணிப்பு',
    'Quality (QA/QC)':   'தரம் (QA/QC)',
    'HSE & Safety':      'HSE & பாதுகாப்பு',
    'CRM & Reports':     'CRM & அறிக்கைகள்',
    'Assets & IT':       'சொத்துக்கள் & IT',
    'Documents':         'ஆவணங்கள்',
    'Administration':    'நிர்வாகம்',

    // ── Nav items ──
    'Dashboard':              'டாஷ்போர்டு',
    'Projects':               'திட்டங்கள்',
    'P&E Dashboard':          'P&E டாஷ்போர்டு',
    'Schedule & Activities':  'அட்டவணை & செயல்பாடுகள்',
    'Milestones':             'மைல்கற்கள்',
    'Look-Ahead Plan':        'முன்னோக்கு திட்டம்',
    'Progress & S-Curve':     'முன்னேற்றம் & S-வளைவு',
    'Delay Analysis':         'தாமத பகுப்பாய்வு',
    'Employees':              'ஊழியர்கள்',
    'Attendance':             'வருகைப்பதிவு',
    'Leave Management':       'விடுப்பு மேலாண்மை',
    'Payroll':                'சம்பளம்',
    'Salary Structures':      'சம்பள அமைப்புகள்',
    'Departments':            'துறைகள்',
    'Holiday Calendar':       'விடுமுறை அட்டவணை',
    'Loans & Advances':       'கடன்கள் & முன்பணம்',
    'Expense Claims':         'செலவு கோரிக்கைகள்',
    'Appraisals':             'மதிப்பீடுகள்',
    'HR Reports':             'HR அறிக்கைகள்',
    'Import from Greythr':    'Greythr இல் இருந்து இறக்கு',
    'ESSL Biometric Sync':    'ESSL பயோமெட்ரிக் ஒத்திசைவு',
    'Daily Progress (DPR)':   'தினசரி முன்னேற்றம் (DPR)',
    'Site Workers':           'தள தொழிலாளர்கள்',
    'Worker Attendance':      'தொழிலாளர் வருகை',
    'Worker Payroll':         'தொழிலாளர் சம்பளம்',
    'Vendors':                'விற்பனையாளர்கள்',
    'Quotations & CS':        'மேற்கோள்கள் & CS',
    'Purchase Orders':        'கொள்முதல் ஆர்டர்கள்',
    'Inventory':              'சரக்கு',
    'GRN':                    'GRN',
    'Material Requisition':   'பொருள் கோரிக்கை',
    'Issue Notes (MIN)':      'வழங்கல் குறிப்புகள்',
    'Store Ledger':           'கிடங்கு பேரேடு',
    'Work Orders':            'வேலை ஆர்டர்கள்',
    'Measurement Book':       'அளவுக்கட்டு நோட்டு',
    'Sub-Con RA Bills':       'துணை ஒப்பந்த RA பில்கள்',
    'BOQ & Estimation':       'BOQ & மதிப்பீடு',
    'RA Bills':               'RA பில்கள்',
    'Material Recon':         'பொருள் சரிபார்ப்பு',
    'QS Reports':             'QS அறிக்கைகள்',
    'GST Billing':            'GST கட்டணம்',
    'TDS Register':           'TDS பதிவு',
    'Vendor Payables':        'விற்பனையாளர் செலுத்தல்',
    'Budget vs Actual':       'பட்ஜெட் vs உண்மையான',
    'Payments':               'பணம் செலுத்துதல்',
    'Billing Reports':        'கட்டண அறிக்கைகள்',
    'Finance Intelligence':   'நிதி நுண்ணறிவு',
    'DQS Dashboard':          'DQS டாஷ்போர்டு',
    'All Bills':              'அனைத்து பில்கள்',
    'Pending Bills':          'நிலுவை பில்கள்',
    'Stores Queue':           'கிடங்கு வரிசை',
    'QS Certification':       'QS சான்றிதழ்',
    'Accounts':               'கணக்குகள்',
    'Paid Bills':             'செலுத்தப்பட்ட பில்கள்',
    'Material Tracker':       'பொருள் கண்காணிப்பு',
    'Reports':                'அறிக்கைகள்',
    'Analytics':              'பகுப்பாய்வு',
    'QA/QC Hub':              'QA/QC மையம்',
    'RFI Ledger':             'RFI பேரேடு',
    'Document Control':       'ஆவண கட்டுப்பாடு',
    'Checklist Masters':      'சரிபார்ப்பு பட்டியல்',
    'Snag List':              'குறைபாடு பட்டியல்',
    'Safety Dashboard':       'பாதுகாப்பு டாஷ்போர்டு',
    'Incident Hub':           'சம்பவ மையம்',
    'Permit to Work':         'பணி அனுமதி',
    'PPE Tracking':           'PPE கண்காணிப்பு',
    'Client Bookings':        'வாடிக்கையாளர் முன்பதிவுகள்',
    'Asset Register':         'சொத்து பதிவு',
    'IT Assets':              'IT சொத்துக்கள்',
    'Help Desk':              'உதவி மேசை',
    'Licenses & AMC':         'உரிமங்கள் & AMC',
    'Document Repository':    'ஆவண இடம்',
    'Team Members':           'குழு உறுப்பினர்கள்',
  },

  kn: {
    // ── App shell ──
    'Search…': 'ಹುಡುಕಿ…',
    'Logout': 'ನಿರ್ಗಮಿಸಿ',
    'Language': 'ಭಾಷೆ',

    // ── Nav groups ──
    'Overview':          'ಅವಲೋಕನ',
    'Planning':          'ಯೋಜನೆ',
    'HR & Admin':        'HR & ಆಡಳಿತ',
    'Procurement':       'ಖರೀದಿ',
    'Stores':            'ಗೋದಾಮು',
    'Subcontractors':    'ಉಪ-ಗುತ್ತಿಗೆದಾರರು',
    'QS & Billing':      'QS & ಬಿಲ್ಲಿಂಗ್',
    'Finance':           'ಹಣಕಾಸು',
    'DQS Tracker':       'DQS ಟ್ರ್ಯಾಕರ್',
    'Quality (QA/QC)':   'ಗುಣಮಟ್ಟ (QA/QC)',
    'HSE & Safety':      'HSE & ಸುರಕ್ಷತೆ',
    'CRM & Reports':     'CRM & ವರದಿಗಳು',
    'Assets & IT':       'ಆಸ್ತಿಗಳು & IT',
    'Documents':         'ದಾಖಲೆಗಳು',
    'Administration':    'ಆಡಳಿತ',

    // ── Nav items ──
    'Dashboard':              'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'Projects':               'ಯೋಜನೆಗಳು',
    'P&E Dashboard':          'P&E ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'Schedule & Activities':  'ವೇಳಾಪಟ್ಟಿ & ಚಟುವಟಿಕೆಗಳು',
    'Milestones':             'ಮೈಲಿಗಲ್ಲುಗಳು',
    'Look-Ahead Plan':        'ಮುಂದಿನ ಯೋಜನೆ',
    'Progress & S-Curve':     'ಪ್ರಗತಿ & S-ವಕ್ರರೇಖೆ',
    'Delay Analysis':         'ವಿಳಂಬ ವಿಶ್ಲೇಷಣೆ',
    'Employees':              'ಉದ್ಯೋಗಿಗಳು',
    'Attendance':             'ಹಾಜರಾತಿ',
    'Leave Management':       'ರಜೆ ನಿರ್ವಹಣೆ',
    'Payroll':                'ಸಂಬಳ',
    'Salary Structures':      'ಸಂಬಳ ರಚನೆಗಳು',
    'Departments':            'ವಿಭಾಗಗಳು',
    'Holiday Calendar':       'ರಜಾ ಕ್ಯಾಲೆಂಡರ್',
    'Loans & Advances':       'ಸಾಲಗಳು & ಮುಂಗಡ',
    'Expense Claims':         'ವೆಚ್ಚ ಕ್ಲೇಮ್‌ಗಳು',
    'Appraisals':             'ಮೌಲ್ಯಮಾಪನಗಳು',
    'HR Reports':             'HR ವರದಿಗಳು',
    'Import from Greythr':    'Greythr ನಿಂದ ಆಮದು',
    'ESSL Biometric Sync':    'ESSL ಬಯೋಮೆಟ್ರಿಕ್ ಸಿಂಕ್',
    'Daily Progress (DPR)':   'ದೈನಂದಿನ ಪ್ರಗತಿ (DPR)',
    'Site Workers':           'ಸೈಟ್ ಕಾರ್ಮಿಕರು',
    'Worker Attendance':      'ಕಾರ್ಮಿಕ ಹಾಜರಾತಿ',
    'Worker Payroll':         'ಕಾರ್ಮಿಕ ಸಂಬಳ',
    'Vendors':                'ಮಾರಾಟಗಾರರು',
    'Quotations & CS':        'ಕೋಟೇಶನ್‌ಗಳು & CS',
    'Purchase Orders':        'ಖರೀದಿ ಆದೇಶಗಳು',
    'Inventory':              'ದಾಸ್ತಾನು',
    'GRN':                    'GRN',
    'Material Requisition':   'ವಸ್ತು ವಿನಂತಿ',
    'Issue Notes (MIN)':      'ವಿತರಣೆ ಟಿಪ್ಪಣಿಗಳು',
    'Store Ledger':           'ಗೋದಾಮು ಲೆಡ್ಜರ್',
    'Work Orders':            'ಕೆಲಸದ ಆದೇಶಗಳು',
    'Measurement Book':       'ಅಳತೆ ಪುಸ್ತಕ',
    'Sub-Con RA Bills':       'ಉಪ-ಗುತ್ತಿಗೆ RA ಬಿಲ್‌ಗಳು',
    'BOQ & Estimation':       'BOQ & ಅಂದಾಜು',
    'RA Bills':               'RA ಬಿಲ್‌ಗಳು',
    'Material Recon':         'ವಸ್ತು ಸಾಮಂಜಸ್ಯ',
    'QS Reports':             'QS ವರದಿಗಳು',
    'GST Billing':            'GST ಬಿಲ್ಲಿಂಗ್',
    'TDS Register':           'TDS ನೋಂದಣಿ',
    'Vendor Payables':        'ಮಾರಾಟಗಾರ ಪಾವತಿ',
    'Budget vs Actual':       'ಬಜೆಟ್ vs ನೈಜ',
    'Payments':               'ಪಾವತಿಗಳು',
    'Billing Reports':        'ಬಿಲ್ಲಿಂಗ್ ವರದಿಗಳು',
    'Finance Intelligence':   'ಹಣಕಾಸು ಬುದ್ಧಿಮತ್ತೆ',
    'DQS Dashboard':          'DQS ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'All Bills':              'ಎಲ್ಲಾ ಬಿಲ್‌ಗಳು',
    'Pending Bills':          'ಬಾಕಿ ಬಿಲ್‌ಗಳು',
    'Stores Queue':           'ಗೋದಾಮು ಸರದಿ',
    'QS Certification':       'QS ಪ್ರಮಾಣೀಕರಣ',
    'Accounts':               'ಖಾತೆಗಳು',
    'Paid Bills':             'ಪಾವತಿಸಿದ ಬಿಲ್‌ಗಳು',
    'Material Tracker':       'ವಸ್ತು ಟ್ರ್ಯಾಕರ್',
    'Reports':                'ವರದಿಗಳು',
    'Analytics':              'ವಿಶ್ಲೇಷಣೆ',
    'QA/QC Hub':              'QA/QC ಕೇಂದ್ರ',
    'RFI Ledger':             'RFI ಲೆಡ್ಜರ್',
    'Document Control':       'ದಾಖಲೆ ನಿಯಂತ್ರಣ',
    'Checklist Masters':      'ಚೆಕ್‌ಲಿಸ್ಟ್ ಮಾಸ್ಟರ್ಸ್',
    'Snag List':              'ದೋಷ ಪಟ್ಟಿ',
    'Safety Dashboard':       'ಸುರಕ್ಷತೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'Incident Hub':           'ಘಟನೆ ಕೇಂದ್ರ',
    'Permit to Work':         'ಕೆಲಸದ ಅನುಮತಿ',
    'PPE Tracking':           'PPE ಟ್ರ್ಯಾಕಿಂಗ್',
    'Client Bookings':        'ಗ್ರಾಹಕ ಬುಕಿಂಗ್‌ಗಳು',
    'Asset Register':         'ಆಸ್ತಿ ನೋಂದಣಿ',
    'IT Assets':              'IT ಆಸ್ತಿಗಳು',
    'Help Desk':              'ಸಹಾಯ ಮೇಜು',
    'Licenses & AMC':         'ಪರವಾನಗಿಗಳು & AMC',
    'Document Repository':    'ದಾಖಲೆ ಭಂಡಾರ',
    'Team Members':           'ತಂಡದ ಸದಸ್ಯರು',
  },
};

// ── Language metadata ────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English',  flag: '🇬🇧' },
  { code: 'ta', label: 'Tamil',    native: 'தமிழ்',    flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada',  native: 'ಕನ್ನಡ',    flag: '🇮🇳' },
];

// ── Context ──────────────────────────────────────────────────────────────────
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageFn] = useState(
    () => localStorage.getItem('erpLang') || 'en'
  );

  const setLanguage = useCallback((code) => {
    setLanguageFn(code);
    localStorage.setItem('erpLang', code);
    // Update <html lang> for accessibility / font rendering
    document.documentElement.lang = code;
  }, []);

  // Translate a string — falls back to the key itself (English default)
  const t = useCallback((key) => {
    if (language === 'en' || !key) return key;
    return TRANSLATIONS[language]?.[key] ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}
