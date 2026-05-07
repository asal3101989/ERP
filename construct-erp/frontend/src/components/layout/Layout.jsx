// src/components/layout/Layout.jsx
// @3d-sidebar-enhanced
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, FileSpreadsheet, Ruler, Receipt,
  DollarSign, CreditCard, Wallet, TrendingUp, Users, Clock,
  Banknote, FileText, ShoppingCart, Truck, Package,
  HardHat, AlertTriangle, Shield, Cpu, Ticket, Key,
  Home, BarChart3, LogOut, Menu, Bell, ChevronDown,
  Activity, Building, ClipboardList, ArrowUpRight, BookOpen,
  Search, Settings, Warehouse, X, ChevronRight, ChevronLeft,
  ScrollText, BadgeCheck, FileSearch, FolderSearch, ClipboardCheck,
  Briefcase, UploadCloud, Upload, ChevronUp, Flag, CalendarDays, GanttChartSquare, Hammer,
  CalendarOff, FileBarChart, Star, UserCheck, Fingerprint, PackageCheck, ArrowLeftRight,
  Landmark, FileSignature, CircleSlash, ShieldCheck, Clock3,
  Gavel, Target, Send
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import CommandPalette from './CommandPalette';
import { clsx } from 'clsx';
import LoadingScreen from '../common/LoadingScreen';
import { useLanguage, LANGUAGES } from '../../context/LanguageContext';
import NotificationPanel, { useNotificationCount } from './NotificationPanel';

const navGroups = [
  // ── 1. OVERVIEW ────────────────────────────────────────────────────────────
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/projects',  icon: Building2,       label: 'Projects' },
      { to: '/meetings',  icon: Users,           label: 'Meeting Minutes' },
    ]
  },

  // ── 2. PLANNING ─────────────────────────────────────────────────────────────
  {
    label: 'Planning',
    items: [
      { to: '/planning',             icon: GanttChartSquare, label: 'P&E Dashboard' },
      { to: '/planning/dpr',         icon: FileText,         label: 'Planning DPR' },
      { to: '/planning/activities',  icon: ClipboardList,    label: 'Schedule & Activities' },
      { to: '/planning/milestones',  icon: Flag,             label: 'Milestones' },
      { to: '/planning/look-ahead',  icon: CalendarDays,     label: 'Look-Ahead Plan' },
      { to: '/planning/progress',    icon: TrendingUp,       label: 'Progress & S-Curve' },
      { to: '/planning/delays',      icon: AlertTriangle,    label: 'Delay Analysis' },
    ]
  },

  // ── 4. PROCUREMENT (buy materials) ──────────────────────────────────────────
  {
    label: 'Procurement',
    items: [
      { to: '/procurement/vendors',    icon: Users,        label: 'Vendors' },
      { to: '/procurement/live-rate-checker', icon: Search, label: 'Live Rate Checker' },
      { to: '/procurement/po-amendments', icon: FileSignature, label: 'PO Amendments' },
      { to: '/procurement/vendor-performance', icon: Star, label: 'Vendor Performance' },
      { to: '/procurement/rate-contracts', icon: Landmark, label: 'Rate Contracts' },
      { to: '/procurement/vendor-payments', icon: Wallet, label: 'Vendor Payments' },
      { to: '/procurement/quotations',   icon: ScrollText,   label: 'Quotations & CS' },
      { to: '/procurement/po',           icon: ShoppingCart, label: 'Purchase Orders' },
      { to: '/procurement/work-orders',  icon: Hammer,       label: 'Work Orders' },
      { to: '/procurement/inventory',    icon: Package,      label: 'Inventory' },
    ]
  },

  // ── 5. TENDER MANAGEMENT ────────────────────────────────────────────────────
  {
    label: 'Tender Management',
    items: [
      { to: '/tender-management',       icon: Gavel,      label: 'Bid Register'     },
      { to: '/tender-management/issue', icon: FileText,   label: 'Tender Issuance'  },
    ]
  },

  // ── 6. STORES (receive & issue material) ────────────────────────────────────
  {
    label: 'Stores',
    items: [
      { to: '/stores/grn',              icon: PackageCheck,  label: 'GRN' },
      { to: '/stores/mrs',              icon: ClipboardList, label: 'Material Requisition' },
      { to: '/stores/issue',            icon: ArrowUpRight,  label: 'Issue Notes (MIN)' },
      { to: '/stores/ledger',           icon: BookOpen,      label: 'Store Ledger' },
    ]
  },

  // ── 6. SUBCONTRACTORS ───────────────────────────────────────────────────────
  {
    label: 'Subcontractors',
    items: [
      { to: '/subcontractor/hub', icon: Briefcase, label: 'Subcontractor Hub' },
    ]
  },

  // ── 7. QS & BILLING (measure work done, bill client) ────────────────────────
  {
    label: 'QS & Billing',
    items: [
      { to: '/qs/boq',            icon: FileSpreadsheet, label: 'BOQ & Estimation' },
      { to: '/qs/measurements',   icon: Ruler,           label: 'Measurement Book' },
      { to: '/qs/ra-bills',           icon: Receipt,       label: 'RA Bills', badge: 3 },
      { to: '/qs/retention-releases', icon: ShieldCheck,   label: 'Retention Release' },
      { to: '/qs/variations',         icon: ArrowLeftRight,label: 'Variation Orders' },
      { to: '/qs/material-recon',     icon: Activity,      label: 'Material Recon' },
      { to: '/qs/reports',            icon: BarChart3,     label: 'QS Reports' },
    ]
  },

  // ── 8. FINANCE ──────────────────────────────────────────────────────────────
  {
    label: 'Finance',
    items: [
      { to: '/finance',                 icon: BookOpen,      label: 'Overview' },
      { to: '/finance/payables',        icon: FileText,      label: 'Payables' },
      { to: '/finance/payments',        icon: Wallet,        label: 'Payments' },
      { to: '/finance/receivables',     icon: FileSignature, label: 'Receivables' },
      { to: '/finance/tax-compliance',  icon: DollarSign,    label: 'Tax & Compliance' },
      { to: '/finance/reports',         icon: BarChart3,     label: 'Reports' },
    ]
  },

  // ── 9. DQS TRACKER (bill approval workflow) ──────────────────────────────────
  {
    label: 'DQS Tracker',
    items: [
      { to: '/dqs',                  icon: LayoutDashboard, label: 'DQS Dashboard' },
      { to: '/dqs/bills',            icon: FileText,        label: 'Bills' },
      { to: '/dqs/transmittal',      icon: Send,            label: 'Transmittal' },
      { to: '/procurement/vendors',   icon: Users,           label: 'Vendors' },
      { to: '/dqs/material-tracker', icon: Package,         label: 'Material Tracker' },
      { to: '/dqs/analytics',        icon: TrendingUp,      label: 'Analytics' },
      { to: '/dqs/reports',          icon: BarChart3,       label: 'Reports' },
    ]
  },

  // ── 10. QUALITY (QA/QC) ─────────────────────────────────────────────────────
  {
    label: 'Quality (QA/QC)',
    items: [
      { to: '/quality',           icon: BadgeCheck,     label: 'QA/QC Hub' },
      { to: '/quality/drawings',  icon: ScrollText,     label: 'Drawing Register' },
      { to: '/quality/submittals',icon: ClipboardCheck, label: 'Submittals' },
      { to: '/quality/rfi',       icon: FileSearch,     label: 'RFI Ledger' },
      { to: '/quality/ncr',       icon: AlertTriangle,  label: 'NCR Ledger' },
      { to: '/quality/lab-tests', icon: Activity,       label: 'Lab Certifications' },
      { to: '/quality/documents', icon: FolderSearch,   label: 'Document Control' },
      { to: '/quality/templates', icon: ClipboardCheck, label: 'Checklist Masters' },
      { to: '/quality/snags',     icon: Hammer,         label: 'Snag List' },
      { to: '/quality/reports',   icon: BarChart3,      label: 'QA/QC Reports' },
    ]
  },

  // ── 11. HSE & SAFETY ────────────────────────────────────────────────────────
  {
    label: 'HSE & Safety',
    items: [
      { to: '/hse',           icon: Shield,        label: 'Safety Dashboard' },
      { to: '/hse/incidents', icon: AlertTriangle, label: 'Incident Hub' },
      { to: '/hse/permits',   icon: Key,           label: 'Permit to Work' },
      { to: '/hse/ppe',       icon: HardHat,       label: 'PPE Tracking' },
    ]
  },

  // ── 13. ASSETS & IT ─────────────────────────────────────────────────────────
  {
    label: 'Assets & IT',
    items: [
      { to: '/assets',      icon: Warehouse, label: 'Asset Register' },
      { to: '/it/assets',   icon: Cpu,       label: 'IT Assets' },
      { to: '/it/tickets',  icon: Ticket,    label: 'Help Desk', badge: 5 },
      { to: '/it/licenses', icon: Key,       label: 'Licenses & AMC' },
    ]
  },

  // ── 14. DOCUMENTS ───────────────────────────────────────────────────────────
  {
    label: 'Documents',
    items: [
      { to: '/documents', icon: UploadCloud, label: 'Document Repository' },
    ]
  },

  // ── 15. ADMINISTRATION ──────────────────────────────────────────────────────
  {
    label: 'Administration',
    items: [
      { to: '/users', icon: Users, label: 'Team Members' },
    ]
  },

  // ── 16. REPORTS HUB ─────────────────────────────────────────────────────────
  {
    label: 'Reports',
    items: [
      { to: '/reports', icon: FileBarChart, label: 'Reports Hub' },
    ]
  },

  // ── 17. ERP CHAT ─────────────────────────────────────────────────────────────
  {
    label: 'Communication',
    items: [
      { to: '/chat', icon: Send, label: 'ERP Chat' },
    ]
  },
];

// ── Per-group accent colours ────────────────────────────────────────────────
const GROUP_COLORS = {
  'Overview':          '#6366F1',
  'Planning':          '#3B82F6',
  'HR & Admin':        '#8B5CF6',
  'Procurement':       '#F59E0B',
  'Tender Management': '#06B6D4',
  'Stores':            '#14B8A6',
  'Subcontractors':    '#F97316',
  'QS & Billing':      '#10B981',
  'Finance':           '#22C55E',
  'DQS Tracker':       '#6366F1',
  'Quality (QA/QC)':   '#3B82F6',
  'HSE & Safety':      '#EF4444',
  'Assets & IT':       '#64748B',
  'Documents':         '#0EA5E9',
  'Administration':    '#A855F7',
  'Reports':           '#F43F5E',
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Floating particle seeds (stable across renders) ────────────────────────
const PARTICLES = [
  { id:0, left:'12%', size:2,   dur:9,  delay:0   },
  { id:1, left:'28%', size:2.5, dur:12, delay:2   },
  { id:2, left:'48%', size:1.5, dur:8,  delay:1   },
  { id:3, left:'64%', size:2,   dur:11, delay:3.5 },
  { id:4, left:'78%', size:2.5, dur:10, delay:1.8 },
  { id:5, left:'38%', size:1.5, dur:14, delay:4.5 },
  { id:6, left:'55%', size:2,   dur:9,  delay:6   },
  { id:7, left:'20%', size:1.5, dur:13, delay:3   },
];

// ── 3D tilt wrapper for nav items ──────────────────────────────────────────
// Each item tracks mouse position and tilts in 3D space.
// The inner icon box also gets a Z-lift so it visually "floats" above the card.
function NavItem3D({ item, isActive, groupColor, idx, to, onClick }) {
  const ref        = useRef(null);
  const rawX       = useMotionValue(0);
  const rawY       = useMotionValue(0);
  const rotateX    = useSpring(rawX, { stiffness: 380, damping: 28, mass: 0.6 });
  const rotateY    = useSpring(rawY, { stiffness: 380, damping: 28, mass: 0.6 });
  const [hovered, setHovered] = React.useState(false);

  const onMouseMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    rawX.set(((e.clientY - r.top)  / r.height - 0.5) * -9);
    rawY.set(((e.clientX - r.left) / r.width  - 0.5) *  12);
  };
  const onMouseLeave = () => { rawX.set(0); rawY.set(0); setHovered(false); };
  const onMouseEnter = () => setHovered(true);
  const Icon = item.icon;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, x: -20, rotateY: -20 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.95, rotateX: 8, transition: { duration: 0.12 } }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 700 }}
    >
      <NavLink
        to={to}
        end={to === '/dashboard'}
        onClick={onClick}
        className="flex items-center gap-3 mx-2 px-3 py-2 rounded-[10px] transition-colors relative overflow-hidden"
        style={isActive ? {
          background: 'rgba(255,255,255,0.13)',
          borderLeft: `3px solid ${groupColor}`,
          paddingLeft: '9px',
          boxShadow: `0 4px 18px ${hexToRgba(groupColor, 0.28)}, 0 0 0 1px ${hexToRgba(groupColor, 0.15)}`,
        } : {
          borderLeft: '3px solid transparent',
          paddingLeft: '9px',
          background: hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        }}
      >
        {/* Active shimmer bar */}
        {isActive && (
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
            style={{
              position: 'absolute', inset: 0, width: '35%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Icon box — lifts in Z on hover */}
        <motion.div
          animate={{
            translateZ: hovered ? 16 : isActive ? 6 : 0,
            y:          hovered ? -1  : 0,
            scale:      hovered ? 1.08 : 1,
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transformStyle: 'preserve-3d',
            background: isActive ? hexToRgba(groupColor, 0.22) : hovered ? hexToRgba(groupColor, 0.14) : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isActive ? hexToRgba(groupColor, 0.45) : hovered ? hexToRgba(groupColor, 0.25) : 'rgba(255,255,255,0.10)'}`,
            boxShadow: isActive
              ? `0 4px 12px ${hexToRgba(groupColor, 0.45)}, 0 0 0 1px ${hexToRgba(groupColor, 0.2)}`
              : hovered
              ? `0 6px 16px ${hexToRgba(groupColor, 0.35)}`
              : 'none',
            transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          }}
        >
          <motion.div
            animate={{ rotateY: hovered ? 360 : 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', transformStyle: 'preserve-3d' }}
          >
            <Icon style={{ width: 13, height: 13, color: isActive ? groupColor : hovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.80)' }} />
          </motion.div>
        </motion.div>

        {/* Label */}
        <motion.span
          animate={{ x: hovered ? 2 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="text-[13px] flex-1 truncate"
          style={{ color: '#FFFFFF', fontWeight: isActive ? 600 : 400 }}
        >
          {item.label}
        </motion.span>

        {/* Badge */}
        {item.badge && (
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: '#EF4444', color: '#FFF', minWidth: 18, textAlign: 'center', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
          >
            {item.badge}
          </motion.span>
        )}
      </NavLink>
    </motion.div>
  );
}

// ── 3D icon button for collapsed mode ──────────────────────────────────────
function CollapsedIcon3D({ item, isActive, groupColor, onClick, to }) {
  const ref      = useRef(null);
  const rawX     = useMotionValue(0);
  const rawY     = useMotionValue(0);
  const rotateX  = useSpring(rawX, { stiffness: 450, damping: 30 });
  const rotateY  = useSpring(rawY, { stiffness: 450, damping: 30 });
  const [hov, setHov] = React.useState(false);
  const Icon = item.icon;

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    rawX.set(((e.clientY - r.top)  / r.height - 0.5) * -14);
    rawY.set(((e.clientX - r.left) / r.width  - 0.5) *  18);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { rawX.set(0); rawY.set(0); setHov(false); }}
      whileTap={{ scale: 0.88, transition: { duration: 0.1 } }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 500 }}
    >
      <NavLink
        to={to}
        end={to === '/dashboard'}
        title={item.label}
        onClick={onClick}
        style={{
          width: 40, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 9, position: 'relative',
          background: isActive ? hexToRgba(groupColor, 0.24) : hov ? 'rgba(255,255,255,0.10)' : 'transparent',
          border: `1px solid ${isActive ? hexToRgba(groupColor, 0.45) : hov ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
          boxShadow: isActive ? `0 0 14px ${hexToRgba(groupColor, 0.32)}` : hov ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
          transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
        }}
      >
        <motion.div
          animate={{ translateZ: hov ? 12 : isActive ? 4 : 0, scale: hov ? 1.15 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          style={{ transformStyle: 'preserve-3d', display: 'flex' }}
        >
          <motion.div
            animate={{ rotateY: hov ? 360 : 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', transformStyle: 'preserve-3d' }}
          >
            <Icon style={{ width: 14, height: 14, color: isActive ? groupColor : hov ? '#FFFFFF' : 'rgba(255,255,255,0.72)' }} />
          </motion.div>
        </motion.div>
        {item.badge && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
        )}
      </NavLink>
    </motion.div>
  );
}

function usePageTitle() {
  const location = useLocation();
  const smartMatch = (itemTo) => {
    const p = itemTo.split('?')[0];
    if (location.pathname === p) return true;
    const segs = p.split('/').filter(Boolean);
    return segs.length >= 2 && location.pathname.startsWith(p + '/');
  };
  // Prefer longest matching path (most specific)
  let best = null;
  for (const g of navGroups) {
    for (const item of g.items) {
      if (smartMatch(item.to)) {
        if (!best || item.to.length > best.item.to.length) {
          best = { item, group: g.label };
        }
      }
    }
  }
  if (best) return { title: best.item.label, group: best.group };
  return { title: 'ConstructERP', group: '' };
}

function Accordion({ open, children }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="accordion"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [langOpen, setLangOpen]       = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const notifCount = useNotificationCount();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { title: pageTitle, group: pageGroup } = usePageTitle();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Global Ctrl+K / Cmd+K shortcut to open command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Exact match for top-level routes (/finance, /planning …)
  // Prefix match only for routes with 2+ segments (/finance/gst, /qs/ra-bills …)
  const matchesPath = (itemTo) => {
    const p = itemTo.split('?')[0];
    if (location.pathname === p) return true;
    const segments = p.split('/').filter(Boolean);
    return segments.length >= 2 && location.pathname.startsWith(p + '/');
  };

  const [expandedGroups, setExpandedGroups] = useState(() => {
    const active = navGroups.find(g => g.items.some(it => matchesPath(it.to)));
    return active ? [active.label] : ['Overview'];
  });

  useEffect(() => {
    const active = navGroups.find(g => g.items.some(it => matchesPath(it.to)));
    if (active && !expandedGroups.includes(active.label)) {
      setExpandedGroups(prev => [...prev, active.label]);
    }
  }, [location.pathname]);

  const toggle = (label) =>
    setExpandedGroups(prev =>
      prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]
    );

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const navRef = useRef(null);
  const navScrollPos = useRef(0);

  // Save scroll position before navigation
  const handleNavClick = () => {
    if (navRef.current) navScrollPos.current = navRef.current.scrollTop;
  };

  // Restore scroll position after navigation
  useEffect(() => {
    if (navRef.current) navRef.current.scrollTop = navScrollPos.current;
  }, [location.pathname]);
  const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const roleLabel = (user?.role || '').replace(/_/g, ' ');

  const Sidebar = () => (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'linear-gradient(180deg, #1E40AF 0%, #1E3A8A 55%, #172554 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background orbs */}
      <motion.div
        animate={{ y: [0, -30, 0], x: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: -60, right: -60,
          width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.14), transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />
      <motion.div
        animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        style={{
          position: 'absolute', bottom: 60, left: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.10), transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* Floating particles */}
      {PARTICLES.map(p => (
        <motion.div
          key={p.id}
          animate={{ y: [0, -120, 0], opacity: [0, 0.55, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          style={{
            position: 'absolute', left: p.left, bottom: '10%',
            width: p.size, height: p.size, borderRadius: '50%',
            background: 'rgba(255,255,255,0.65)',
            pointerEvents: 'none', zIndex: 0,
          }}
        />
      ))}

      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={clsx(
          'flex items-center gap-3 flex-shrink-0',
          collapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'
        )}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 1 }}
      >
        <motion.div
          whileHover={{ scale: 1.08, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ boxShadow: '0 4px 16px rgba(37,99,235,0.3), 0 0 0 1px rgba(255,255,255,0.15)', minWidth: 40 }}
        >
          <img src="/bcim-logo.png" alt="BCIM" className="w-9 h-9 object-contain" />
        </motion.div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-white leading-tight">BCIM ENGINEERING</div>
            <div className="text-xs font-semibold text-white leading-tight">PRIVATE LIMITED</div>
            <div className="text-[10px] mt-0.5 text-white/60">ConstructERP · v3.0</div>
          </div>
        )}
      </motion.div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav ref={navRef} onClickCapture={handleNavClick} className="flex-1 overflow-y-auto py-2 zoho-scroll" style={{ position: 'relative', zIndex: 1 }}>
        {navGroups.filter(g => {
          if (['admin', 'super_admin', 'managing_director'].includes(user?.role)) return true;
          if (g.label === 'Overview') return true;
          return user?.accessible_modules?.includes(g.label);
        }).map((group) => {
          const isOpen = expandedGroups.includes(group.label);
          const groupColor = GROUP_COLORS[group.label] || '#6366F1';
          const hasActive = group.items.some(it => matchesPath(it.to));

          return (
            <div key={group.label}>

              {/* Group toggle — hidden in collapsed mode */}
              {!collapsed && (
                <motion.button
                  onClick={() => toggle(group.label)}
                  whileHover={{ x: 2 }}
                  className="w-full flex items-center gap-2 px-4 py-2 transition-colors"
                  style={{ color: '#FFFFFF' }}
                >
                  {/* Coloured dot */}
                  <span style={{
                    width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                    background: groupColor,
                    boxShadow: hasActive ? `0 0 6px ${groupColor}` : 'none',
                    transition: 'box-shadow 0.3s',
                  }} />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider flex-1 text-left"
                    style={{
                      letterSpacing: '0.09em',
                      color: hasActive ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
                      transition: 'color 0.3s',
                    }}
                  >
                    {t(group.label)}
                  </span>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </motion.div>
                </motion.button>
              )}

              {/* Faint rule under closed groups in full mode */}
              {!collapsed && !isOpen && (
                <div style={{ height: 1, margin: '0 16px 4px', background: 'rgba(255,255,255,0.06)' }} />
              )}

              {/* ── Items ── */}
              {collapsed ? (
                // Icon-only column — 3D tilt icons
                <div className="py-0.5 flex flex-col items-center gap-0.5">
                  {group.items.map((item) => {
                    const itemPath = item.to.split('?')[0];
                    const itemSearch = item.to.includes('?') ? item.to.split('?')[1] : null;
                    const segments = itemPath.split('/').filter(Boolean);
                    const isActive = itemSearch
                      ? location.pathname === itemPath && location.search === `?${itemSearch}`
                      : location.pathname === itemPath ||
                        (segments.length >= 2 && location.pathname.startsWith(itemPath + '/'));
                    return (
                      <CollapsedIcon3D
                        key={item.to}
                        item={item}
                        isActive={isActive}
                        groupColor={groupColor}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                      />
                    );
                  })}
                </div>
              ) : (
                // Full-width accordion items — 3D tilt cards
                <Accordion open={isOpen}>
                  <div className="pb-1">
                    {group.items.map((item, idx) => {
                      const itemPath = item.to.split('?')[0];
                      const itemSearch = item.to.includes('?') ? item.to.split('?')[1] : null;
                      const segments = itemPath.split('/').filter(Boolean);
                      const isActive = itemSearch
                        ? location.pathname === itemPath && location.search === `?${itemSearch}`
                        : location.pathname === itemPath ||
                          (segments.length >= 2 && location.pathname.startsWith(itemPath + '/'));
                      return (
                        <NavItem3D
                          key={item.to}
                          item={item}
                          isActive={isActive}
                          groupColor={groupColor}
                          idx={idx}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                        />
                      );
                    })}
                  </div>
                </Accordion>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 1 }}>
        {collapsed ? (
          // Collapsed: avatar only → links to /profile
          <NavLink to="/profile" title={`${user?.name || 'User'} — ${roleLabel}`} className="flex justify-center">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2,
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: '#1E3A8A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#FFFFFF',
                }}>{initials}</div>
              </div>
              {/* Online dot */}
              <span style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 8, height: 8, borderRadius: '50%',
                background: '#22C55E', border: '1.5px solid #1E3A8A',
              }} />
            </div>
          </NavLink>
        ) : (
          // Full mode
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            {/* Avatar with gradient ring + online dot */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2,
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: '#1E3A8A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#FFFFFF',
                }}>{initials}</div>
              </div>
              <span style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 8, height: 8, borderRadius: '50%',
                background: '#22C55E', border: '1.5px solid #1E3A8A',
              }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate leading-none mb-0.5">{user?.name || 'User'}</div>
              <div className="text-[11px] capitalize truncate leading-none" style={{ color: 'rgba(255,255,255,0.50)' }}>{roleLabel}</div>
            </div>
            <div className="flex items-center gap-1">
              <NavLink
                to="/profile"
                title="Settings"
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ color: 'rgba(255,255,255,0.60)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#FFFFFF'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.60)'; }}
                onClick={e => e.stopPropagation()}
              >
                <Settings className="w-3.5 h-3.5" />
              </NavLink>
              <button
                onClick={handleLogout}
                title={t('Logout')}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ color: 'rgba(255,255,255,0.60)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#FCA5A5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.60)'; }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA] print:h-auto print:overflow-visible print:block">

      {/* Desktop sidebar */}
      <motion.aside
        className="hidden lg:flex flex-col flex-shrink-0 print:hidden relative"
        animate={{ width: collapsed ? 64 : 230 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{ boxShadow: '2px 0 12px rgba(0,0,0,0.2)', overflow: 'visible', minWidth: 0 }}
      >
        <Sidebar />
        {/* Collapse toggle pill */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute', right: -12, top: '50%',
            transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%',
            background: '#FFFFFF', border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 50, flexShrink: 0,
          }}
        >
          {collapsed
            ? <ChevronRight style={{ width: 12, height: 12, color: '#1E40AF' }} />
            : <ChevronLeft  style={{ width: 12, height: 12, color: '#1E40AF' }} />}
        </button>
      </motion.aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-[240px] h-full flex flex-col" style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}>
            <Sidebar />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto">

        {/* Topbar */}
        <header
          className="flex-shrink-0 flex items-center gap-3 px-5 h-[56px] bg-white z-30 print:hidden"
          style={{ borderBottom: '1px solid #E8EAED', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1.5 text-sm">
            {pageGroup && <span className="text-slate-400 text-sm">{pageGroup}</span>}
            {pageGroup && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
            <span className="font-semibold text-slate-700">{pageTitle}</span>
          </div>

          <div className="flex-1" />

          {/* Search — click to open command palette */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg w-full max-w-[280px] transition-all hover:opacity-80 cursor-pointer text-left"
            style={{ background: '#F1F3F4', border: '1px solid #E8EAED' }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#5F6368' }} />
            <span className="bg-transparent text-sm flex-1" style={{ color: '#80868B' }}>
              {t('Search…')}
            </span>
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
              style={{ background: '#E8EAED', color: '#80868B', border: '1px solid #DADCE0' }}
            >
              ⌘K
            </kbd>
          </button>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-sm font-medium select-none"
              style={{ color: '#5F6368', border: '1px solid #E8EAED' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F1F3F4'}
              onMouseLeave={e => { if (!langOpen) e.currentTarget.style.background = 'transparent'; }}
              title="Change language"
            >
              <span className="text-base leading-none">{currentLang.flag}</span>
              <span className="hidden sm:block text-[12px] font-semibold" style={{ color: '#5F6368' }}>
                {currentLang.native}
              </span>
              <ChevronDown className={clsx('w-3 h-3 transition-transform', langOpen && 'rotate-180')} style={{ color: '#9AA0A6' }} />
            </button>

            {langOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                {/* Dropdown */}
                <div
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-2xl overflow-hidden z-50 py-1"
                  style={{ background: '#fff', border: '1px solid #E8EAED', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                >
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        language === lang.code ? 'bg-blue-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <span className="text-lg leading-none">{lang.flag}</span>
                      <div>
                        <div className={clsx('text-[13px] font-semibold', language === lang.code ? 'text-blue-600' : 'text-slate-800')}>
                          {lang.native}
                        </div>
                        <div className="text-[10px] text-slate-400">{lang.label}</div>
                      </div>
                      {language === lang.code && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bell + Notification Panel */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="relative p-2 rounded-full transition-all"
              style={{ color: '#5F6368' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F1F3F4'}
              onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = 'transparent'; }}
            >
              <Bell className="w-[18px] h-[18px]" />
              {notifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[9px] font-black text-white leading-none">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <NotificationPanel onClose={() => setNotifOpen(false)} />
            )}
          </div>

          {/* Profile */}
          <NavLink
            to="/profile"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all"
            style={{ border: '1px solid #E8EAED' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F1F3F4'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1967D2, #9334E9)' }}
            >
              {initials}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {user?.name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </NavLink>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto print:overflow-visible print:h-auto">
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navGroups={navGroups.filter(g => {
          if (['admin', 'super_admin', 'managing_director'].includes(user?.role)) return true;
          if (g.label === 'Overview') return true;
          return user?.accessible_modules?.includes(g.label);
        })}
      />

      <style>{`
        .zoho-scroll::-webkit-scrollbar { width: 4px; }
        .zoho-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 4px; }
        .zoho-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.30); border-radius: 4px; }
        .zoho-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.65); }
      `}</style>
    </div>
  );
}
