// src/pages/Dashboard_ZOHO.jsx - ZOHO ERP Style Dashboard
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Receipt, Shield, Building2,
  ArrowRight, Activity, Package, Briefcase, Plus, Clock, Users,
  TrendingUp, HardHat, FileText, Calendar, BarChart3, PieChart,
  TrendingDown, DollarSign, Target, Zap, Settings, Filter,
  Download, RefreshCw, Eye, Edit, Trash2, MoreVertical
} from 'lucide-react';
import { projectAPI, incidentAPI, poAPI, raBillAPI, analyticsAPI } from '../api/client';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import { clsx } from 'clsx';
import dayjs from 'dayjs';

const inr = (val) => {
  if (!val) return 'Rs.0';
  const n = parseFloat(val);
  if (n >= 1e7) return `Rs.${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `Rs.${(n / 1e5).toFixed(2)} L`;
  return `Rs.${n.toLocaleString('en-IN')}`;
};

const toArr = (r) => {
  const d = r?.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  return [];
};

// ZOHO-style Widget Components
const KPIWidget = ({ title, value, subtitle, icon, trend, color, size = 'normal' }) => {
  const sizeClasses = {
    small: 'p-4',
    normal: 'p-6',
    large: 'p-8'
  };
  
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
      className={clsx(
        "bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-200",
        sizeClasses[size]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          <p className="text-sm text-gray-600">{subtitle}</p>
          {trend && (
            <div className={clsx("flex items-center gap-1 mt-2 text-xs font-medium", 
              trend.value > 0 ? "text-green-600" : "text-red-600")}>
              {trend.value > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </div>
        <div className={clsx("w-12 h-12 rounded-lg flex items-center justify-center", color)}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

const ChartWidget = ({ title, type, data, height = 200 }) => {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div style={{ height: `${height}px` }} className="bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center text-gray-500">
          <BarChart3 className="w-8 h-8 mx-auto mb-2" />
          <p className="text-xs">Interactive Chart</p>
          <p className="text-xs text-gray-400">{type} visualization</p>
        </div>
      </div>
    </motion.div>
  );
};

const ActivityWidget = ({ title, activities, maxHeight = 300 }) => {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All</button>
      </div>
      <div className="space-y-3" style={{ maxHeight: `${maxHeight}px`, overflowY: 'auto' }}>
        {activities.map((activity, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <activity.icon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.list().then(toArr).catch(() => []),
  });

  const { data: safety } = useQuery({
    queryKey: ['safety-dashboard'],
    queryFn: () => incidentAPI.safetyDashboard().then(r => r.data).catch(() => null),
  });

  const { data: globalStats } = useQuery({
    queryKey: ['analytics-global'],
    queryFn: () => analyticsAPI.global().then(r => r.data?.data?.global).catch(() => null),
  });

  const { data: raBills = [] } = useQuery({
    queryKey: ['ra-bills-dash'],
    queryFn: () => raBillAPI.list().then(toArr).catch(() => []),
  });

  const { data: recentPOs = [] } = useQuery({
    queryKey: ['po-dash'],
    queryFn: () => poAPI.list().then(toArr).catch(() => []),
  });

  const { data: recentPayments = [] } = useQuery({
    queryKey: ['payments-dash'],
    queryFn: () => api.get('/payments').then(toArr).catch(() => []),
  });

  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeRaBills = Array.isArray(raBills) ? raBills : [];
  const safePOs = Array.isArray(recentPOs) ? recentPOs : [];
  const safePayments = Array.isArray(recentPayments) ? recentPayments : [];

  const activeProjects = safeProjects.filter(p => p.status === 'active');
  const delayedProjects = safeProjects.filter(p => p.status === 'delayed');
  const totalContract = safeProjects.reduce((s, p) => s + parseFloat(p.contract_value || 0), 0);
  const totalBilled = safeProjects.reduce((s, p) => s + parseFloat(p.total_billed || 0), 0);
  const totalWorkers = safeProjects.reduce((s, p) => s + parseInt(p.worker_count || 0), 0);
  const pendingRABills = safeRaBills.filter(b => b.status === 'submitted' || b.status === 'draft');
  const pendingRAValue = pendingRABills.reduce((s, b) => s + parseFloat(b.net_payable || b.total_amount || 0), 0);
  const openIncidents = safety?.open_incidents ?? 0;
  const safetyScore = safety?.safety_score ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ZOHO-style Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">BCIM ERP Dashboard</h1>
              <p className="text-sm text-gray-500">Welcome back, {user?.name?.split(' ')[0] || 'User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button 
              onClick={() => setIsRefreshing(!isRefreshing)}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={clsx("w-4 h-4 text-gray-600", isRefreshing && "animate-spin")} />
            </button>
            <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="p-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <KPIWidget
            title="Total Revenue"
            value={inr(totalContract)}
            subtitle={`${activeProjects.length} active projects`}
            icon={<DollarSign className="w-6 h-6 text-blue-600" />}
            color="bg-blue-100"
            trend={{ value: 12.5, label: "vs last month" }}
          />
          <KPIWidget
            title="Active Projects"
            value={activeProjects.length}
            subtitle={`${delayedProjects.length} delayed`}
            icon={<Target className="w-6 h-6 text-green-600" />}
            color="bg-green-100"
            trend={{ value: 8.2, label: "vs last month" }}
          />
          <KPIWidget
            title="Pending Bills"
            value={pendingRABills.length}
            subtitle={inr(pendingRAValue)}
            icon={<Receipt className="w-6 h-6 text-amber-600" />}
            color="bg-amber-100"
            trend={{ value: -3.1, label: "vs last month" }}
          />
          <KPIWidget
            title="Safety Score"
            value={safetyScore !== null ? `${Math.round(safetyScore)}/100` : 'N/A'}
            subtitle={`${openIncidents} open incidents`}
            icon={<Shield className="w-6 h-6 text-red-600" />}
            color="bg-red-100"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartWidget
            title="Revenue Trend"
            type="Line Chart"
            height={250}
          />
          <ChartWidget
            title="Project Status Distribution"
            type="Pie Chart"
            height={250}
          />
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Project Overview</h2>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Filter className="w-4 h-4 mr-1" /> Filter
                  </button>
                  <Link to="/projects" className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    View All
                  </Link>
                </div>
              </div>
              <div className="space-y-4">
                {safeProjects.slice(0, 5).map((proj, i) => (
                  <div key={proj.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-600">
                        {proj.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{proj.name}</h3>
                        <p className="text-sm text-gray-500">{proj.city || 'India'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{inr(proj.contract_value)}</p>
                      <p className="text-sm text-gray-500">{proj.progress_pct || 0}% complete</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div>
            <ActivityWidget
              title="Recent Activity"
              activities={[
                { title: "New PO created", time: "2 hours ago", icon: FileText },
                { title: "RA Bill submitted", time: "4 hours ago", icon: Receipt },
                { title: "Project milestone completed", time: "6 hours ago", icon: Target },
                { title: "Safety inspection conducted", time: "1 day ago", icon: Shield },
              ]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
