import React, { useState, useEffect, useMemo } from 'react';

const STAGE_KEYS = ['BRD', 'DESIGN_APPROVAL', 'DATA_MODEL', 'PIPELINE', 'VISUAL', 'UAT', 'PRODUCTION'];
const STAGE_LABEL = { BRD: 'BRD', DESIGN_APPROVAL: 'Design Approval', DATA_MODEL: 'Data Model', PIPELINE: 'Pipeline', VISUAL: 'Visual', UAT: 'UAT', PRODUCTION: 'Production' };
const SHORT = { BRD: 'BRD', DESIGN_APPROVAL: 'DSN', DATA_MODEL: 'DM', PIPELINE: 'PIPE', VISUAL: 'VIS', UAT: 'UAT', PRODUCTION: 'PROD' };
const NEEDS_APPROVAL = { BRD: true, DESIGN_APPROVAL: true, DATA_MODEL: true, PIPELINE: true, UAT: true };
const REBUILD_THRESHOLD = 3;
const STATE_KEY = 'remat-delivery-hub-state-v1';
const MAX_FILE_BYTES = 3 * 1024 * 1024;

const genId = () => 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const nowIso = () => new Date().toISOString();
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateShort = (s) => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
const fmtDateTime = (s) => s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const daysAgo = (s) => Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
const formatBytes = (n) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
const attachmentName = (a) => typeof a === 'string' ? a : (a?.name || 'file');
const attachmentDataUrl = (a) => (typeof a === 'object' && a !== null) ? (a.dataUrl || null) : null;
function downloadAttachment(att, showToast) {
  if (typeof att === 'string') {
    if (showToast) showToast(`"${att}" is a legacy attachment · no file content was stored when this was uploaded`, 'warn');
    return;
  }
  const url = att?.dataUrl;
  if (!url) { if (showToast) showToast(`No content stored for ${att?.name || 'this attachment'}`, 'warn'); return; }
  const link = document.createElement('a');
  link.href = url;
  link.download = att.name || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function seedData() {
  const roles = [
    { id: genId(), key: 'ADMIN', name: 'Admin', description: 'Full system access', permissions: { addUsers: true, manageLookups: true, overrideApprovals: true, viewAll: true }, isAdmin: true, isSystem: true },
    { id: genId(), key: 'DA_LEAD', name: 'D&A Lead', description: 'Receives escalations', permissions: { viewAll: true, raiseCr: true, receiveEscalations: true }, isAdmin: false, isSystem: true },
    { id: genId(), key: 'DATA_ENGINEER', name: 'Data Engineer', description: 'Owns DM and Pipeline', permissions: { editOwnStages: ['DATA_MODEL', 'PIPELINE'], raiseCr: true }, isAdmin: false, isSystem: true },
    { id: genId(), key: 'BI_DEVELOPER', name: 'BI Developer', description: 'Owns Design and Visual', permissions: { editOwnStages: ['DESIGN_APPROVAL', 'VISUAL'], raiseCr: true }, isAdmin: false, isSystem: true },
    { id: genId(), key: 'SPONSOR', name: 'Sponsor', description: 'Approves BRD and Design', permissions: { approveBrd: true, approveDesign: true, raiseCr: true }, isAdmin: false, isSystem: true },
    { id: genId(), key: 'DATA_OWNER', name: 'Data Owner', description: 'Signs off UAT', permissions: { signoffUat: true, raiseCr: true }, isAdmin: false, isSystem: true },
    { id: genId(), key: 'BA', name: 'Business Analyst', description: 'Drafts BRDs', permissions: { draftBrd: true, raiseCr: true }, isAdmin: false, isSystem: true },
    { id: genId(), key: 'VIEWER', name: 'Viewer', description: 'Read-only', permissions: { viewAssigned: true }, isAdmin: false, isSystem: true }
  ];
  const r = Object.fromEntries(roles.map(r => [r.key, r.id]));
  const users = [
    { id: genId(), email: 'saad@remat.sa', name: 'Saad (D&A Lead)', roleId: r.ADMIN, scope: null, status: 'Active', createdAt: nowIso() },
    { id: genId(), email: 'admin@remat.sa', name: 'Admin', roleId: r.ADMIN, scope: null, status: 'Active', createdAt: nowIso() },
    { id: genId(), email: 'yasir@remat.sa', name: 'Yasir', roleId: r.DATA_ENGINEER, scope: null, status: 'Active', createdAt: nowIso() },
    { id: genId(), email: 'ahmad@remat.sa', name: 'Ahmad', roleId: r.BI_DEVELOPER, scope: null, status: 'Active', createdAt: nowIso() },
    { id: genId(), email: 'cfo@remat.sa', name: 'CFO', roleId: r.SPONSOR, scope: { domains: ['Finance'] }, status: 'Active', createdAt: nowIso() },
    { id: genId(), email: 'procurement.director@remat.sa', name: 'Procurement Director', roleId: r.SPONSOR, scope: { domains: ['Procurement'] }, status: 'Active', createdAt: nowIso() },
    { id: genId(), email: 'csso@remat.sa', name: 'CSSO', roleId: r.SPONSOR, scope: { domains: ['Strategy', 'Compliance'] }, status: 'Active', createdAt: nowIso() }
  ];
  const u = Object.fromEntries(users.map(x => [x.email.split('@')[0].replace('.', '_'), x.id]));
  const crTypes = [
    { id: genId(), key: 'SCOPE_CHANGE', name: 'Scope change', description: 'Sponsor adds or removes metrics', routesTo: 'BRD', isSystem: true },
    { id: genId(), key: 'VISUAL_CHANGE', name: 'Visual / UX change', description: 'Layout, chart type, formatting', routesTo: 'DESIGN_APPROVAL', isSystem: true },
    { id: genId(), key: 'KPI_LOGIC_CHANGE', name: 'KPI logic change', description: 'Calculation formula change', routesTo: 'BRD', isSystem: true },
    { id: genId(), key: 'PRODUCTION_BUG', name: 'Production bug', description: 'Wrong values, missing data', routesTo: 'UAT', isSystem: true },
    { id: genId(), key: 'PERFORMANCE_ISSUE', name: 'Performance issue', description: 'Slow load time', routesTo: 'PIPELINE', isSystem: true }
  ];
  const dashboardDefs = [
    { num: 1, name: 'Procurement — Spend Analytics', domain: 'Procurement', tier: 'P1', approvers: ['procurement_director', 'cfo'], owner: 'saad', requester: 'procurement_director' },
    { num: 2, name: 'Procurement — Supplier Performance', domain: 'Procurement', tier: 'P2', approvers: ['procurement_director'], owner: 'saad', requester: 'procurement_director' },
    { num: 3, name: 'IT Tickets — SLA & Volume', domain: 'IT SM', tier: 'P2', approvers: [], owner: 'saad', requester: null },
    { num: 4, name: 'IT Tickets — Backlog & Aging', domain: 'IT SM', tier: 'P2', approvers: [], owner: 'saad', requester: null },
    { num: 5, name: 'Procurement — PR/PO Cycle Time', domain: 'Procurement', tier: 'P2', approvers: ['procurement_director'], owner: 'saad', requester: 'procurement_director' },
    { num: 6, name: 'Procurement — Contract Compliance', domain: 'Procurement', tier: 'P2', approvers: ['procurement_director', 'csso'], owner: 'saad', requester: 'csso' },
    { num: 7, name: 'Strategy — KPI Scorecard', domain: 'Strategy', tier: 'P1', approvers: ['csso', 'cfo'], owner: 'saad', requester: 'csso' },
    { num: 8, name: 'Strategy — Initiatives Tracker', domain: 'Strategy', tier: 'P2', approvers: ['csso'], owner: 'saad', requester: 'csso' },
    { num: 9, name: 'HCM — Headcount & Movements', domain: 'HCM', tier: 'P2', approvers: [], owner: 'saad', requester: null },
    { num: 10, name: 'Strategy — Performance vs Plan', domain: 'Strategy', tier: 'P2', approvers: ['csso'], owner: 'saad', requester: 'csso' },
    { num: 11, name: 'HCM — Attrition & Time-to-Hire', domain: 'HCM', tier: 'P2', approvers: [], owner: 'saad', requester: null },
    { num: 12, name: 'Strategy — Risk Register', domain: 'Strategy', tier: 'P3', approvers: ['csso'], owner: 'saad', requester: 'csso' },
    { num: 13, name: 'Finance — Cash Flow', domain: 'Finance', tier: 'P2', approvers: ['cfo'], owner: 'saad', requester: 'cfo' },
    { num: 14, name: 'Finance — AR Aging', domain: 'Finance', tier: 'P3', approvers: ['cfo'], owner: 'saad', requester: 'cfo' },
    { num: 15, name: 'Operations — Maintenance Tickets', domain: 'Operations', tier: 'P3', approvers: [], owner: 'saad', requester: null }
  ];
  const dashboards = [];
  const stages = [];
  const numToId = {};
  dashboardDefs.forEach(d => {
    const dashId = genId();
    numToId[d.num] = dashId;
    dashboards.push({
      id: dashId, num: d.num, name: d.name, domain: d.domain, tier: d.tier,
      approverIds: d.approvers.map(k => u[k]).filter(Boolean),
      ownerId: d.owner ? u[d.owner] : null,
      requesterId: d.requester ? u[d.requester] : null,
      status: 'Planning'
    });
  });
  const plannedMap = computePlannedDates(dashboards);
  dashboardDefs.forEach(d => {
    const dashId = numToId[d.num];
    STAGE_KEYS.forEach((key, idx) => {
      const ownerId = (key === 'DATA_MODEL' || key === 'PIPELINE') ? u.yasir : (key === 'DESIGN_APPROVAL' || key === 'VISUAL') ? u.ahmad : (key === 'BRD' ? u.saad : null);
      stages.push({ id: genId(), dashboardId: dashId, stageKey: key, stageOrder: idx + 1, ownerId, plannedDate: plannedMap[dashId]?.[key] || null, actualDate: null, rebuildCount: 0, escalated: false, status: 'Not Started', submittedAt: null, approvedAt: null, createdAt: nowIso() });
    });
  });
  return { users, roles, dashboards, stages, approvals: [], crTypes, crs: [], auditLog: [] };
}

async function loadState() {
  try {
    const r = await window.storage.get(STATE_KEY);
    if (!r || !r.value) return null;
    return migrate(JSON.parse(r.value));
  } catch { return null; }
}

function migrate(state) {
  if (!state) return state;
  const adminRole = (state.roles || []).find(r => r.key === 'ADMIN');
  if (adminRole && !(state.users || []).some(u => u.email === 'admin@remat.sa')) {
    state.users = [...(state.users || []), {
      id: genId(), email: 'admin@remat.sa', name: 'Admin', roleId: adminRole.id,
      scope: null, status: 'Active', createdAt: nowIso()
    }];
  }
  state.dashboards = (state.dashboards || []).map(d => {
    const base = d.approverIds ? d : { ...d, approverIds: [...new Set([d.sponsorId, d.dataOwnerId].filter(Boolean))] };
    return {
      ...base,
      ownerId: base.ownerId !== undefined ? base.ownerId : null,
      requesterId: base.requesterId !== undefined ? base.requesterId : null
    };
  });
  state.approvals = (state.approvals || []).map(a => {
    const base = {
      ...a,
      attachments: a.attachments || (a.fileName ? [a.fileName] : []),
      approverIds: a.approverIds || (a.approverId ? [a.approverId] : []),
      decidedById: a.decidedById || (a.status !== 'Pending' ? a.approverId : null),
      crId: a.crId || null,
      stageId: a.stageId || (a.crId ? null : a.stageId)
    };
    if (base.approverStates && base.approverStates.length > 0) return base;
    const states = base.approverIds.map(id => {
      if (base.status === 'Pending' || !base.status) {
        return { approverId: id, originalApproverId: id, status: 'Pending', comment: null, decidedAt: null, delegatedToId: null, delegatedFromId: null };
      }
      const isDecider = id === base.decidedById;
      return {
        approverId: id, originalApproverId: id,
        status: isDecider ? base.status : (base.status === 'Approved' ? 'Approved' : 'Pending'),
        comment: isDecider ? base.comment : null,
        decidedAt: isDecider ? base.decidedAt : null,
        delegatedToId: null, delegatedFromId: null
      };
    });
    return { ...base, approverStates: states };
  });
  state.crs = (state.crs || []).map(c => ({
    ...c,
    resolution: c.resolution || null,
    closedAt: c.closedAt || null
  }));
  const plannedMap = computePlannedDates(state.dashboards);
  state.stages = (state.stages || []).map(s => {
    if (s.plannedDate) return s;
    const p = plannedMap[s.dashboardId]?.[s.stageKey];
    return p ? { ...s, plannedDate: p } : s;
  });
  return state;
}
async function saveState(state) {
  try { await window.storage.set(STATE_KEY, JSON.stringify(state)); } catch (e) { console.error('save failed', e); }
}
async function resetState() { try { await window.storage.delete(STATE_KEY); } catch {} }

function getPerms(role) { return role?.permissions || {}; }
function canApprove(user, role, stageKey) {
  if (!user || !role) return false;
  const p = getPerms(role);
  if (role.isAdmin && p.overrideApprovals) return true;
  if (stageKey === 'BRD') return !!p.approveBrd;
  if (stageKey === 'DESIGN_APPROVAL') return !!p.approveDesign;
  if (stageKey === 'UAT') return !!p.signoffUat;
  return false;
}
function canEditStage(role, stageKey) {
  if (!role) return false;
  const p = getPerms(role);
  if (role.isAdmin) return true;
  return (p.editOwnStages || []).includes(stageKey);
}
function canViewDashboard(user, role, dashboard) {
  if (!user || !role || !dashboard) return false;
  if (role.isAdmin) return true;
  const p = getPerms(role);
  if (p.viewAll) return true;
  const scopedDomains = user.scope?.domains;
  if (!scopedDomains || scopedDomains.length === 0) return true;
  if (scopedDomains.includes(dashboard.domain)) return true;
  if (dashboard.ownerId === user.id) return true;
  if (dashboard.requesterId === user.id) return true;
  if ((dashboard.approverIds || []).includes(user.id)) return true;
  return false;
}
function defaultStageOwner(state, stageKey, dashboardOwnerId) {
  const findByRoleKey = (roleKey) => {
    const role = state.roles.find(r => r.key === roleKey);
    if (!role) return null;
    const u = state.users.find(u => u.roleId === role.id && u.status === 'Active');
    return u?.id || null;
  };
  if (stageKey === 'BRD') return findByRoleKey('BA') || findByRoleKey('DA_LEAD') || dashboardOwnerId || findByRoleKey('ADMIN');
  if (stageKey === 'DATA_MODEL' || stageKey === 'PIPELINE') return findByRoleKey('DATA_ENGINEER') || dashboardOwnerId;
  if (stageKey === 'DESIGN_APPROVAL' || stageKey === 'VISUAL') return findByRoleKey('BI_DEVELOPER') || dashboardOwnerId;
  return dashboardOwnerId || null;
}
function isTechnicalApproval(stageKey) {
  return stageKey === 'DATA_MODEL' || stageKey === 'PIPELINE';
}
function approversForStage(dashboard, stageKey, state) {
  if (isTechnicalApproval(stageKey)) {
    const ownerId = dashboard?.ownerId;
    if (ownerId) {
      const owner = state.users.find(u => u.id === ownerId && u.status === 'Active');
      if (owner) return [owner];
    }
    const adminRole = state.roles.find(r => r.isAdmin);
    if (adminRole) {
      const admin = state.users.find(u => u.roleId === adminRole.id && u.status === 'Active');
      if (admin) return [admin];
    }
    return [];
  }
  return (dashboard?.approverIds || []).map(id => state.users.find(u => u.id === id)).filter(Boolean);
}
function computePlannedDates(dashboards) {
  if (!dashboards || dashboards.length === 0) return {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const totalDays = Math.max(60, Math.floor((yearEnd.getTime() - today.getTime()) / 86400000));
  const stageGap = 7;
  const cycleDays = (STAGE_KEYS.length - 1) * stageGap;
  const tierRank = { P1: 0, P2: 1, P3: 2 };
  const sorted = [...dashboards].sort((a, b) => ((tierRank[a.tier] ?? 99) - (tierRank[b.tier] ?? 99)) || ((a.num || 0) - (b.num || 0)));
  const n = sorted.length;
  const stagger = n > 1 ? Math.max(3, Math.floor((totalDays - cycleDays) / (n - 1))) : 0;
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const result = {};
  sorted.forEach((d, idx) => {
    result[d.id] = {};
    const dashStart = today.getTime() + idx * stagger * 86400000;
    STAGE_KEYS.forEach((key, sIdx) => {
      result[d.id][key] = fmt(new Date(dashStart + sIdx * stageGap * 86400000));
    });
  });
  return result;
}
function recomputeApprovalStatus(approverStates) {
  const active = (approverStates || []).filter(s => s.status !== 'Delegated');
  if (active.length === 0) return 'Pending';
  if (active.some(s => s.status === 'Rejected')) return 'Rejected';
  if (active.every(s => s.status === 'Approved')) return 'Approved';
  return 'Pending';
}
function applyDecision(approval, userId, decision, comment) {
  const now = nowIso();
  const updatedStates = (approval.approverStates || []).map(s =>
    s.approverId === userId && s.status === 'Pending'
      ? { ...s, status: decision === 'approve' ? 'Approved' : 'Rejected', comment: comment || null, decidedAt: now }
      : s
  );
  return { approverStates: updatedStates, status: recomputeApprovalStatus(updatedStates), now };
}
function applyDelegation(approval, fromUserId, toUserId, reason) {
  const now = nowIso();
  if (fromUserId === toUserId) return { error: 'Cannot delegate to yourself' };
  const existing = (approval.approverStates || []).find(s => s.approverId === toUserId && s.status !== 'Delegated');
  if (existing) return { error: 'That user is already in this approval cycle' };
  const updatedStates = (approval.approverStates || []).map(s =>
    s.approverId === fromUserId && s.status === 'Pending'
      ? { ...s, status: 'Delegated', comment: reason || null, decidedAt: now, delegatedToId: toUserId }
      : s
  );
  updatedStates.push({ approverId: toUserId, originalApproverId: toUserId, status: 'Pending', comment: null, decidedAt: null, delegatedToId: null, delegatedFromId: fromUserId });
  return { approverStates: updatedStates, status: recomputeApprovalStatus(updatedStates), now };
}
function myApproverState(approval, userId) {
  return (approval?.approverStates || []).find(s => s.approverId === userId && s.status !== 'Delegated') || null;
}
function isMyTurn(approval, userId) {
  if (!approval || approval.status !== 'Pending') return false;
  const mine = myApproverState(approval, userId);
  return mine?.status === 'Pending';
}

const Badge = ({ tone = 'gray', children }) => {
  const tones = {
    green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800', blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-700', purple: 'bg-purple-100 text-purple-800',
    navy: 'bg-[#1F2D5A] text-white', gold: 'bg-[#C9A94F] text-[#3A2E0F]'
  };
  return <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${tones[tone]}`}>{children}</span>;
};
const Card = ({ children, className = '' }) => <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>{children}</div>;
const Btn = ({ variant = 'secondary', children, ...props }) => {
  const v = {
    primary: 'bg-[#1F2D5A] hover:bg-[#16223F] text-white border border-[#1F2D5A]',
    secondary: 'bg-white hover:bg-gray-50 text-gray-800 border border-gray-300',
    success: 'bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-700',
    danger: 'bg-red-100 hover:bg-red-200 text-red-800 border border-red-300'
  };
  return <button {...props} className={`${v[variant]} font-medium px-3 py-1.5 rounded text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}>{children}</button>;
};
const Input = (props) => <input {...props} className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1F2D5A] focus:border-[#1F2D5A] ${props.className || ''}`} />;
const Select = ({ children, ...props }) => <select {...props} className={`w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F2D5A] ${props.className || ''}`}>{children}</select>;
const TextArea = (props) => <textarea {...props} className={`w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1F2D5A] focus:border-[#1F2D5A] ${props.className || ''}`} />;
const Label = ({ children }) => <label className="text-xs text-gray-600 font-medium block mb-1">{children}</label>;
const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  const w = size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${w} max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-start p-5 border-b border-gray-200">
          <h3 className="text-base font-medium">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

function statusTone(status) {
  if (status === 'Approved') return 'green';
  if (status === 'Pending Approval') return 'amber';
  if (status === 'Rejected') return 'red';
  if (status === 'In Progress') return 'blue';
  return 'gray';
}

const NAV = [
  { href: 'home', label: 'Home', icon: '🏠' },
  { href: 'workspace', label: 'My Workspace', icon: '📦' },
  { href: 'approvals', label: 'Approvals', icon: '✓' },
  { href: 'dashboards', label: 'Dashboards', icon: '📊' },
  { href: 'crs', label: 'Change Requests', icon: '🔄' },
  { href: 'scorecard', label: 'Scorecard', icon: '📈', adminOnly: true },
  { href: 'gantt', label: 'Gantt', icon: '📅', adminOnly: true },
  { href: 'reports', label: 'Reports', icon: '📑', adminOnly: true },
  { href: 'admin-users', label: 'Users', icon: '👥', adminOnly: true },
  { href: 'admin-dashboards', label: 'Manage Dashboards', icon: '🗂️', adminOnly: true },
  { href: 'admin-workflow', label: 'Workflow & Lookups', icon: '⚙️', adminOnly: true },
  { href: 'admin-audit', label: 'Audit Log', icon: '📋', adminOnly: true },
  { href: 'admin-settings', label: 'Settings', icon: '🔧', adminOnly: true }
];

export default function App() {
  const [state, setState] = useState(null);
  const [page, setPage] = useState('login');
  const [params, setParams] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      let s = await loadState();
      if (!s) { s = seedData(); await saveState(s); }
      setState(s); setLoading(false);
    })();
  }, []);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const update = async (newState) => { setState(newState); await saveState(newState); };
  const audit = (action, entity, entityId, details) => {
    const newLog = { id: genId(), userId: currentUserId, action, entity, entityId, details, createdAt: nowIso() };
    return { auditLog: [newLog, ...(state.auditLog || [])] };
  };
  const showToast = (msg, kind = 'success') => setToast({ msg, kind });
  const go = (p, ps = {}) => { setPage(p); setParams(ps); };

  const currentUser = useMemo(() => state?.users.find(u => u.id === currentUserId) || null, [state, currentUserId]);
  const currentRole = useMemo(() => state?.roles.find(r => r.id === currentUser?.roleId) || null, [state, currentUser]);
  const isAdmin = !!currentRole?.isAdmin;

  if (loading || !state) {
    return <div className="min-h-[600px] flex items-center justify-center text-gray-500 text-sm">Loading Remat Delivery Hub…</div>;
  }

  if (!currentUser) {
    return <LoginPage state={state} onLogin={(uid) => { setCurrentUserId(uid); setPage('home'); }} onReset={async () => { await resetState(); const fresh = seedData(); setState(fresh); await saveState(fresh); }} />;
  }

  const ctx = { state, update, audit, showToast, currentUser, currentRole, isAdmin, go, params };

  return (
    <div className="bg-[#FAFAF8] min-h-[700px] font-sans text-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="flex">
        <Sidebar page={page} isAdmin={isAdmin} go={go} />
        <div className="flex-1 min-w-0">
          <TopBar state={state} currentUser={currentUser} currentRole={currentRole} setCurrentUserId={setCurrentUserId} setPage={setPage} />
          <main className="p-6 max-w-[1400px]">
            {page === 'home' && <HomePage ctx={ctx} />}
            {page === 'workspace' && <WorkspacePage ctx={ctx} />}
            {page === 'approvals' && <ApprovalsInbox ctx={ctx} />}
            {page === 'review' && <ReviewPage ctx={ctx} />}
            {page === 'dashboards' && <DashboardsCatalog ctx={ctx} />}
            {page === 'dashboard-detail' && <DashboardDetail ctx={ctx} />}
            {page === 'crs' && <CrsLog ctx={ctx} />}
            {page === 'crs-new' && <NewCrPage ctx={ctx} />}
            {page === 'scorecard' && (isAdmin ? <Scorecard ctx={ctx} /> : <Forbidden />)}
            {page === 'gantt' && (isAdmin ? <GanttView ctx={ctx} /> : <Forbidden />)}
            {page === 'reports' && (isAdmin ? <ReportsPage ctx={ctx} /> : <Forbidden />)}
            {page === 'admin-users' && (isAdmin ? <UsersAdmin ctx={ctx} /> : <Forbidden />)}
            {page === 'admin-dashboards' && (isAdmin ? <AdminDashboards ctx={ctx} /> : <Forbidden />)}
            {page === 'admin-workflow' && (isAdmin ? <WorkflowAdmin ctx={ctx} /> : <Forbidden />)}
            {page === 'admin-audit' && (isAdmin ? <AuditPage ctx={ctx} /> : <Forbidden />)}
            {page === 'admin-settings' && (isAdmin ? <SettingsPage ctx={ctx} /> : <Forbidden />)}
            {page === 'accept-invite' && <AcceptInvitePage ctx={ctx} setCurrentUserId={setCurrentUserId} />}
          </main>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.kind === 'error' ? 'bg-red-600 text-white' : toast.kind === 'warn' ? 'bg-amber-600 text-white' : 'bg-emerald-700 text-white'}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}

function Forbidden() {
  return <div className="text-center py-16"><div className="text-4xl mb-2">🔒</div><div className="text-sm text-gray-500">You don't have permission to view this page.</div></div>;
}

function LoginPage({ state, onLogin, onReset }) {
  const [email, setEmail] = useState('saad@remat.sa');
  const tryLogin = () => {
    const u = state.users.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!u) { alert('No user with that email. Try saad@remat.sa'); return; }
    if (u.status !== 'Active') { alert('Account not active'); return; }
    onLogin(u.id);
  };
  return (
    <div className="min-h-[700px] flex items-center justify-center bg-[#FAFAF8] p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-xs tracking-[3px] text-[#1F2D5A] font-semibold">REMAT</div>
          <div className="text-lg font-medium mt-1">D&A Delivery Hub</div>
          <div className="text-xs text-gray-500 mt-1">Sign in with your work email</div>
        </div>
        <Label>Email</Label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@remat.sa" className="mb-3" />
        <Label>Password</Label>
        <Input type="password" defaultValue="changeme123" disabled className="mb-4 bg-gray-50" />
        <Btn variant="primary" onClick={tryLogin} className="w-full">Sign in</Btn>
        <div className="border-t border-gray-200 mt-6 pt-4">
          <div className="text-xs text-gray-500 mb-2">Quick login (demo):</div>
          <div className="space-y-1">
            {state.users.filter(u => u.status === 'Active').map(u => {
              const role = state.roles.find(r => r.id === u.roleId);
              return (
                <button key={u.id} onClick={() => onLogin(u.id)} className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 text-left">
                  <span className="text-xs">{u.name}</span>
                  <Badge tone="gray">{role?.name}</Badge>
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-center mt-5 pt-4 border-t border-gray-200">
          <button onClick={() => { if (confirm('Reset all demo data?')) onReset(); }} className="text-xs text-gray-400 hover:text-red-600">Reset demo data</button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ page, isAdmin, go }) {
  const items = NAV.filter(n => !n.adminOnly || isAdmin);
  return (
    <aside className="w-56 bg-[#1F2D5A] text-white flex flex-col shrink-0" style={{ minHeight: '700px' }}>
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-[10px] tracking-[3px] text-white/60">REMAT</div>
        <div className="text-sm font-medium">Delivery Hub</div>
      </div>
      <nav className="flex-1 py-2">
        {items.map(it => {
          const active = page === it.href || (it.href === 'dashboards' && page === 'dashboard-detail') || (it.href === 'approvals' && page === 'review') || (it.href === 'crs' && page === 'crs-new');
          return (
            <button key={it.href} onClick={() => go(it.href)}
              className={`w-full px-5 py-2 text-sm text-left transition flex items-center gap-2 ${active ? 'bg-white/10 border-l-2 border-[#C9A94F]' : 'border-l-2 border-transparent hover:bg-white/5'}`}>
              <span className="text-[11px] opacity-70 w-4">{it.icon}</span>
              {it.label}
            </button>
          );
        })}
      </nav>
      <div className="px-5 py-3 text-xs text-white/40 border-t border-white/10">v1.0 · demo</div>
    </aside>
  );
}

function TopBar({ state, currentUser, currentRole, setCurrentUserId, setPage }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium">{currentUser.name}</div>
          <div className="text-xs text-gray-500">{currentRole?.name}</div>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#1F2D5A] text-white flex items-center justify-center text-xs font-medium">
          {currentUser.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <Select value={currentUser.id} onChange={(e) => setCurrentUserId(e.target.value)} className="w-44 text-xs">
          {state.users.filter(u => u.status === 'Active').map(u => <option key={u.id} value={u.id}>Switch: {u.name}</option>)}
        </Select>
        <Btn onClick={() => { setCurrentUserId(null); setPage('login'); }} className="text-xs">Sign out</Btn>
      </div>
    </header>
  );
}

function HomePage({ ctx }) {
  const { state, currentUser, currentRole, isAdmin, go } = ctx;
  const visibleDashboards = state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d));
  const myDashboards = isAdmin ? visibleDashboards : visibleDashboards.filter(d => {
    if (d.ownerId === currentUser.id) return true;
    if (d.requesterId === currentUser.id) return true;
    if ((d.approverIds || []).includes(currentUser.id)) return true;
    return state.stages.some(s => s.dashboardId === d.id && s.ownerId === currentUser.id);
  });
  const enriched = myDashboards.map(d => {
    const stages = state.stages.filter(s => s.dashboardId === d.id).sort((a, b) => a.stageOrder - b.stageOrder);
    const total = stages.length;
    const done = stages.filter(s => s.actualDate).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const current = stages.find(s => s.status === 'In Progress' || s.status === 'Pending Approval');
    const fullyDelivered = total > 0 && done === total;
    const blocked = stages.some(s => s.status === 'Rejected');
    const roles = [];
    if (d.ownerId === currentUser.id) roles.push('owner');
    if (d.requesterId === currentUser.id) roles.push('requester');
    if ((d.approverIds || []).includes(currentUser.id)) roles.push('approver');
    const myStageCount = stages.filter(s => s.ownerId === currentUser.id).length;
    if (myStageCount > 0) roles.push(`${myStageCount} stage${myStageCount === 1 ? '' : 's'}`);
    return { ...d, stages, total, done, pct, current, fullyDelivered, blocked, roles };
  });
  enriched.sort((a, b) => {
    if (a.fullyDelivered !== b.fullyDelivered) return a.fullyDelivered ? 1 : -1;
    if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
    const tierRank = { P1: 0, P2: 1, P3: 2 };
    return (tierRank[a.tier] - tierRank[b.tier]) || (a.num - b.num);
  });
  const myDashCount = enriched.length;
  const avgPct = myDashCount === 0 ? 0 : Math.round(enriched.reduce((sum, d) => sum + d.pct, 0) / myDashCount);
  const fullyDelivered = enriched.filter(d => d.fullyDelivered).length;
  const pendingMine = state.approvals.filter(a => a.status === 'Pending' && isMyTurn(a, currentUser.id)).length;
  const myDashIds = new Set(enriched.map(d => d.id));
  const myOpenCrs = state.crs.filter(c => myDashIds.has(c.dashboardId) && (c.status === 'Pending Approval' || c.status === 'Open')).length;
  const myDashStageIds = new Set(state.stages.filter(s => myDashIds.has(s.dashboardId)).map(s => s.id));
  const recent = (state.auditLog || []).filter(log => !log.entityId || myDashIds.has(log.entityId) || myDashStageIds.has(log.entityId)).slice(0, 6);
  const userRole = state.roles.find(r => r.id === currentUser.roleId);
  const scopeNote = isAdmin ? 'full admin access' : currentUser.scope?.domains?.length ? `scope: ${currentUser.scope.domains.join(', ')}` : 'no scope restriction';
  return (
    <div>
      <h1 className="text-xl font-medium">Welcome back, {currentUser.name.split(' ')[0]}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">{userRole?.name} · {scopeNote} · {new Date().toLocaleDateString('en-GB')}</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4 cursor-pointer hover:border-[#1F2D5A] transition" onClick={() => go('dashboards')}>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{isAdmin ? 'Dashboards' : 'Your dashboards'}</div>
          <div className="text-3xl font-medium mt-1">{myDashCount}</div>
          <div className="text-xs text-gray-500 mt-1">{fullyDelivered} fully delivered</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Avg progress</div>
          <div className="text-3xl font-medium mt-1">{avgPct}%</div>
          <div className="mt-2 h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-full bg-[#1F2D5A]" style={{ width: `${avgPct}%` }}></div></div>
        </Card>
        <Card className="p-4 cursor-pointer hover:border-[#1F2D5A] transition" onClick={() => go('approvals')}>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Pending your decision</div>
          <div className="text-3xl font-medium mt-1">{pendingMine}</div>
          <div className="text-xs text-gray-500 mt-1">{pendingMine === 0 ? 'inbox clear' : 'in your inbox'}</div>
        </Card>
        <Card className="p-4 cursor-pointer hover:border-[#1F2D5A] transition" onClick={() => go('crs')}>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{isAdmin ? 'Open CRs' : 'Open CRs · your dashboards'}</div>
          <div className="text-3xl font-medium mt-1">{myOpenCrs}</div>
          <div className="text-xs text-gray-500 mt-1">{myOpenCrs === 0 ? 'no open requests' : 'awaiting decision'}</div>
        </Card>
      </div>

      {enriched.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-sm font-medium text-gray-700 mb-1">No dashboards assigned to you yet</div>
          <div className="text-xs text-gray-500">Once an admin adds you as an owner, requester, or approver on a dashboard, it will appear here with its progress.</div>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-medium">{isAdmin ? 'All dashboards' : 'Your dashboards'} <span className="text-xs text-gray-500 font-normal">({enriched.length})</span></h2>
            <button onClick={() => go('dashboards')} className="text-xs text-[#1F2D5A] hover:underline">view all →</button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {enriched.slice(0, 9).map(d => (
              <button key={d.id} onClick={() => go('dashboard-detail', { dashboardId: d.id })} className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-[#1F2D5A] hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <Badge tone="gray">{d.domain}</Badge>
                      <Badge tone={d.tier === 'P1' ? 'red' : d.tier === 'P2' ? 'amber' : 'gray'}>{d.tier}</Badge>
                    </div>
                    <div className="text-sm font-medium truncate" title={d.name}>{d.name}</div>
                  </div>
                  {d.blocked && <span className="text-red-600 text-lg leading-none" title="Rejected stage">⚠</span>}
                  {d.fullyDelivered && <span className="text-emerald-600 text-lg leading-none" title="Fully delivered">✓</span>}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden"><div className={`h-full ${d.fullyDelivered ? 'bg-emerald-600' : d.blocked ? 'bg-red-500' : 'bg-[#1F2D5A]'}`} style={{ width: `${d.pct}%` }}></div></div>
                  <span className="text-xs font-medium text-gray-700 w-9 text-right">{d.pct}%</span>
                </div>
                <div className="text-xs text-gray-500 flex items-center justify-between gap-2 mt-2">
                  <span className="truncate">{d.fullyDelivered ? 'Delivered' : d.current ? `Current: ${STAGE_LABEL[d.current.stageKey]}` : 'Not started'}</span>
                  {d.roles.length > 0 && <span className="text-gray-400 text-[10px] uppercase tracking-wide whitespace-nowrap">{d.roles[0]}{d.roles.length > 1 ? ` +${d.roles.length - 1}` : ''}</span>}
                </div>
              </button>
            ))}
          </div>
          {enriched.length > 9 && <div className="text-xs text-gray-500 mb-6 text-center">+ {enriched.length - 9} more · <button onClick={() => go('dashboards')} className="text-[#1F2D5A] hover:underline">see all</button></div>}
        </>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-medium mb-3">{isAdmin ? 'Recent activity' : 'Recent activity on your dashboards'}</h2>
        {recent.length === 0 ? <p className="text-xs text-gray-500">No activity yet.</p> : (
          <div className="divide-y divide-gray-100">
            {recent.map(r => {
              const u = state.users.find(x => x.id === r.userId);
              return (
                <div key={r.id} className="py-2 text-sm flex justify-between">
                  <div><span className="text-gray-500 mr-2">{u?.name || 'System'}</span>{r.action}</div>
                  <div className="text-xs text-gray-400 whitespace-nowrap ml-3">{fmtDateTime(r.createdAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function WorkspacePage({ ctx }) {
  const { state, currentUser, currentRole, go, params } = ctx;
  const perms = getPerms(currentRole);
  const owned = perms.editOwnStages || [];
  const visibleDashIds = new Set(state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d)).map(d => d.id));
  const myStages = state.stages.filter(s => visibleDashIds.has(s.dashboardId) && (currentRole.isAdmin || owned.includes(s.stageKey)) && (currentRole.isAdmin || s.ownerId === currentUser.id));
  const activeCategory = params.category || null;

  const gateInfo = (stage) => {
    const dashStages = state.stages.filter(x => x.dashboardId === stage.dashboardId);
    const prev = dashStages.filter(x => x.stageOrder < stage.stageOrder).sort((a, b) => b.stageOrder - a.stageOrder)[0] || null;
    const blockedByPrevious = !!prev && prev.status !== 'Approved';
    const isComplete = stage.status === 'Pending Approval' || stage.status === 'Approved';
    return { blockedByPrevious, isComplete, ready: !blockedByPrevious && !isComplete };
  };

  if (!activeCategory) {
    const byCategory = {};
    myStages.forEach(s => {
      const d = state.dashboards.find(x => x.id === s.dashboardId);
      if (!d) return;
      const cat = d.domain || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { name: cat, stages: 0, dashboardIds: new Set(), ready: 0, blocked: 0, pending: 0, approved: 0, rejected: 0 };
      byCategory[cat].stages++;
      byCategory[cat].dashboardIds.add(d.id);
      const g = gateInfo(s);
      if (s.status === 'Approved') byCategory[cat].approved++;
      else if (s.status === 'Pending Approval') byCategory[cat].pending++;
      else if (s.status === 'Rejected') byCategory[cat].rejected++;
      else if (g.blockedByPrevious) byCategory[cat].blocked++;
      else byCategory[cat].ready++;
    });
    const categories = Object.values(byCategory).map(c => ({ ...c, dashboards: c.dashboardIds.size })).sort((a, b) => (b.ready + b.rejected) - (a.ready + a.rejected) || b.stages - a.stages);
    const totalReady = categories.reduce((s, c) => s + c.ready, 0);
    const totalPending = categories.reduce((s, c) => s + c.pending, 0);
    const totalBlocked = categories.reduce((s, c) => s + c.blocked, 0);
    const totalRejected = categories.reduce((s, c) => s + c.rejected, 0);

    return (
      <div>
        <h1 className="text-xl font-medium">My Workspace</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">{currentUser.name} · {currentRole.name} · owns: {owned.length ? owned.map(k => STAGE_LABEL[k]).join(', ') : 'all (admin)'}</p>

        <div className="grid grid-cols-4 gap-4 mb-5">
          <Card className="p-4"><div className="text-xs text-gray-500 uppercase tracking-wide">Total assigned</div><div className="text-3xl font-medium mt-1">{myStages.length}</div><div className="text-xs text-gray-500 mt-1">across {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</div></Card>
          <Card className="p-4 border-emerald-300"><div className="text-xs text-emerald-700 uppercase tracking-wide">🟢 Ready to act</div><div className="text-3xl font-medium mt-1 text-emerald-700">{totalReady + totalRejected}</div><div className="text-xs text-emerald-700 mt-1">{totalRejected > 0 ? `${totalRejected} rejected (rebuild)` : 'unblocked'}</div></Card>
          <Card className="p-4 border-amber-300"><div className="text-xs text-amber-700 uppercase tracking-wide">⏱ Pending approval</div><div className="text-3xl font-medium mt-1 text-amber-700">{totalPending}</div><div className="text-xs text-amber-700 mt-1">awaiting approver decision</div></Card>
          <Card className="p-4"><div className="text-xs text-gray-500 uppercase tracking-wide">🔒 Waiting on gate</div><div className="text-3xl font-medium mt-1 text-gray-500">{totalBlocked}</div><div className="text-xs text-gray-500 mt-1">predecessor not approved</div></Card>
        </div>

        {categories.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-3xl mb-2">📦</div>
            <div className="text-sm font-medium text-gray-700 mb-1">No stages assigned to you</div>
            <div className="text-xs text-gray-500">Once you're set as the owner on a dashboard stage, your work appears here.</div>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {categories.map(c => (
              <button key={c.name} onClick={() => go('workspace', { category: c.name })} className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-[#1F2D5A] hover:shadow-md transition group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Category</div>
                    <div className="text-base font-medium mt-1 group-hover:text-[#1F2D5A]">{c.name}</div>
                  </div>
                  <div className="text-2xl font-medium text-[#1F2D5A]">{c.stages}</div>
                </div>
                <div className="text-xs text-gray-500 mb-3">{c.dashboards} dashboard{c.dashboards === 1 ? '' : 's'}</div>
                <div className="flex gap-1 flex-wrap">
                  {c.ready > 0 && <Badge tone="green">🟢 {c.ready} ready</Badge>}
                  {c.rejected > 0 && <Badge tone="red">↻ {c.rejected} rebuild</Badge>}
                  {c.pending > 0 && <Badge tone="amber">⏱ {c.pending} pending</Badge>}
                  {c.blocked > 0 && <Badge tone="gray">🔒 {c.blocked} waiting</Badge>}
                  {c.approved > 0 && <Badge tone="green">✓ {c.approved} done</Badge>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const inCategory = myStages.filter(s => {
    const d = state.dashboards.find(x => x.id === s.dashboardId);
    return d && (d.domain || 'Uncategorized') === activeCategory;
  });
  const byDashboard = {};
  inCategory.forEach(s => {
    if (!byDashboard[s.dashboardId]) byDashboard[s.dashboardId] = [];
    byDashboard[s.dashboardId].push(s);
  });
  const dashboardList = Object.entries(byDashboard).map(([dashId, stages]) => {
    const d = state.dashboards.find(x => x.id === dashId);
    return { dashboard: d, stages: stages.sort((a, b) => a.stageOrder - b.stageOrder) };
  }).filter(x => x.dashboard).sort((a, b) => {
    const aReady = a.stages.some(s => gateInfo(s).ready);
    const bReady = b.stages.some(s => gateInfo(s).ready);
    if (aReady !== bReady) return aReady ? -1 : 1;
    return (a.dashboard.num || 0) - (b.dashboard.num || 0);
  });

  return (
    <div>
      <button onClick={() => go('workspace')} className="text-sm text-gray-500 hover:text-[#1F2D5A] mb-3 inline-block">← All categories</button>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-medium">My Workspace · {activeCategory}</h1>
          <p className="text-sm text-gray-500 mt-1">{dashboardList.length} dashboard{dashboardList.length === 1 ? '' : 's'} · {inCategory.length} stage{inCategory.length === 1 ? '' : 's'} assigned to you</p>
        </div>
        <Badge tone="gray">{activeCategory}</Badge>
      </div>

      {dashboardList.length === 0 ? (
        <Card className="p-12 text-center text-sm text-gray-500">No stages assigned to you in {activeCategory}.</Card>
      ) : (
        <div className="space-y-4">
          {dashboardList.map(({ dashboard, stages }) => {
            const dashAllStages = state.stages.filter(s => s.dashboardId === dashboard.id);
            const completed = dashAllStages.filter(s => s.actualDate).length;
            const pct = dashAllStages.length === 0 ? 0 : Math.round((completed / dashAllStages.length) * 100);
            const readyCount = stages.filter(s => gateInfo(s).ready).length;
            return (
              <Card key={dashboard.id} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">#{dashboard.num}</span>
                      <Badge tone={dashboard.tier === 'P1' ? 'red' : dashboard.tier === 'P2' ? 'amber' : 'gray'}>{dashboard.tier}</Badge>
                      {readyCount > 0 && <Badge tone="green">🟢 {readyCount} ready</Badge>}
                    </div>
                    <button onClick={() => go('dashboard-detail', { dashboardId: dashboard.id })} className="text-base font-medium hover:text-[#1F2D5A] hover:underline text-left">{dashboard.name}</button>
                    <div className="text-xs text-gray-500 mt-1">{stages.length} stage{stages.length === 1 ? '' : 's'} for you · dashboard overall {pct}% complete</div>
                  </div>
                  <div className="w-32">
                    <div className="h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-full bg-[#1F2D5A]" style={{ width: `${pct}%` }}></div></div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Stage</th>
                      <th className="text-left px-4 py-2 font-medium">Planned</th>
                      <th className="text-left px-4 py-2 font-medium">Actual</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-left px-4 py-2 font-medium">Rebuilds</th>
                      <th className="text-right px-4 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stages.map(s => <StageRow key={s.id} stage={s} ctx={ctx} hideDashboardCell={true} />)}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StageRow({ stage, ctx, hideDashboardCell = false }) {
  const { state, currentUser, update, audit, showToast } = ctx;
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const dashboard = state.dashboards.find(d => d.id === stage.dashboardId);
  const needsApproval = !!NEEDS_APPROVAL[stage.stageKey];
  const technical = isTechnicalApproval(stage.stageKey);
  const approverList = approversForStage(dashboard, stage.stageKey, state);
  const dashboardStages = state.stages.filter(s => s.dashboardId === stage.dashboardId);
  const previousStage = dashboardStages.filter(s => s.stageOrder < stage.stageOrder).sort((a, b) => b.stageOrder - a.stageOrder)[0] || null;
  const blockedByPrevious = !!previousStage && previousStage.status !== 'Approved';
  const isComplete = stage.status === 'Pending Approval' || stage.status === 'Approved';
  const isLocked = isComplete || blockedByPrevious;

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        showToast(`${file.name} is ${formatBytes(file.size)} · max ${formatBytes(MAX_FILE_BYTES)} per file`, 'error');
        continue;
      }
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error('read failed'));
          reader.readAsDataURL(file);
        });
        setAttachments(prev => [...prev, { name: file.name, size: file.size, type: file.type || 'application/octet-stream', dataUrl }]);
      } catch (err) {
        showToast(`Failed to read ${file.name}${err?.message ? ': ' + err.message : ''}`, 'error');
      }
    }
    e.target.value = '';
  };

  const markComplete = async () => {
    if (blockedByPrevious) {
      showToast(`Can't act yet · ${STAGE_LABEL[previousStage.stageKey]} must be approved first`, 'error');
      return;
    }
    setBusy(true);
    const today = nowIso().slice(0, 10);
    const now = nowIso();
    let updates = state.stages.map(s => s.id === stage.id ? { ...s, actualDate: today, status: 'Approved', submittedAt: now, approvedAt: now } : s);
    const dashStages = updates.filter(x => x.dashboardId === stage.dashboardId).sort((a, b) => a.stageOrder - b.stageOrder);
    const nextStage = dashStages.find(x => x.stageOrder > stage.stageOrder);
    if (nextStage && nextStage.status === 'Not Started') {
      updates = updates.map(s => s.id === nextStage.id ? { ...s, status: 'In Progress' } : s);
    }
    const logs = audit(`completed ${STAGE_LABEL[stage.stageKey]} for ${dashboard.name} · actual stamped ${today}`, 'Stage', stage.id).auditLog;
    await update({ ...state, stages: updates, auditLog: logs });
    showToast(`Complete · actual ${today}${nextStage ? ` · ${STAGE_LABEL[nextStage.stageKey]} now in progress` : ''}`);
    setBusy(false);
  };

  const submitForApproval = async () => {
    if (blockedByPrevious) {
      showToast(`Can't submit yet · ${STAGE_LABEL[previousStage.stageKey]} must be approved first`, 'error');
      return;
    }
    if (approverList.length === 0) {
      showToast(technical
        ? `No technical reviewer · ${dashboard?.name || 'this dashboard'} has no owner assigned. Admin must assign one.`
        : `No approvers assigned for ${dashboard.name}. Open Manage Dashboards to assign approvers first.`, 'error');
      return;
    }
    if (technical && attachments.length === 0) {
      showToast(`Evidence required · attach the ${STAGE_LABEL[stage.stageKey]} artifact before submitting`, 'error');
      return;
    }
    setBusy(true);
    const today = nowIso().slice(0, 10);
    const now = nowIso();
    const updates = state.stages.map(s => s.id === stage.id ? { ...s, actualDate: today, status: 'Pending Approval', submittedAt: now } : s);
    const lastVersion = state.approvals.filter(a => a.stageId === stage.id).reduce((m, a) => Math.max(m, a.version), 0);
    const approverStates = approverList.map(u => ({ approverId: u.id, originalApproverId: u.id, status: 'Pending', comment: null, decidedAt: null, delegatedToId: null, delegatedFromId: null }));
    const approvals = [...state.approvals, { id: genId(), stageId: stage.id, approverIds: approverList.map(u => u.id), approverStates, decidedById: null, status: 'Pending', comment: null, decidedAt: null, attachments, version: lastVersion + 1, createdAt: now }];
    const names = approverList.map(u => u.name).join(', ');
    const logs = audit(`submitted ${STAGE_LABEL[stage.stageKey]} for ${technical ? 'technical review' : 'approval'} · actual stamped ${today} · ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`, 'Stage', stage.id).auditLog;
    await update({ ...state, stages: updates, approvals, auditLog: logs });
    showToast(technical
      ? `Submitted to ${names} for technical review · actual ${today} · ${attachments.length} evidence file${attachments.length === 1 ? '' : 's'}`
      : `Submitted · actual ${today} · notified ${approverList.length} approver${approverList.length === 1 ? '' : 's'} (all must approve)`);
    setBusy(false); setShowSubmit(false); setAttachments([]);
  };

  return <>
    <tr className={blockedByPrevious ? 'bg-gray-50/50' : ''}>
      {!hideDashboardCell && (
        <td className="px-4 py-3">
          <div className={`font-medium ${blockedByPrevious ? 'text-gray-500' : ''}`}>{dashboard?.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">#{dashboard?.num} · {dashboard?.domain}</div>
        </td>
      )}
      <td className="px-4 py-3 text-xs"><Badge tone={blockedByPrevious ? 'gray' : 'navy'}>{STAGE_LABEL[stage.stageKey]}</Badge></td>
      <td className="px-4 py-3 text-xs text-gray-600">{stage.plannedDate ? fmtDateShort(stage.plannedDate) : '—'}</td>
      <td className="px-4 py-3 text-xs">{stage.actualDate ? <span className="text-gray-700 font-medium">{fmtDateShort(stage.actualDate)}</span> : blockedByPrevious ? <span className="text-gray-300">—</span> : <span className="text-gray-400 italic">stamped on submit</span>}</td>
      <td className="px-4 py-3"><Badge tone={statusTone(stage.status)}>{stage.status}</Badge>{!isComplete && !blockedByPrevious && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-300">🟢 READY</span>}</td>
      <td className="px-4 py-3 text-xs">{stage.rebuildCount > 0 ? <Badge tone={stage.escalated ? 'red' : 'amber'}>{stage.rebuildCount}× {stage.escalated ? '(escalated)' : ''}</Badge> : '—'}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {blockedByPrevious ? (
          <span className="text-xs text-gray-400" title={`Cannot start ${STAGE_LABEL[stage.stageKey]} · the previous stage (${STAGE_LABEL[previousStage.stageKey]}) is currently "${previousStage.status}" and must be Approved first. You'll get the green light automatically once it's approved.`}>🔒 wait for {SHORT[previousStage.stageKey]}</span>
        ) : isComplete ? (
          <span className="text-xs text-gray-400">—</span>
        ) : needsApproval ? (
          <Btn variant="primary" onClick={() => setShowSubmit(true)} disabled={busy} className="text-xs">{stage.rebuildCount > 0 ? 'Resubmit' : 'Submit for approval'}</Btn>
        ) : (
          <Btn variant="primary" onClick={markComplete} disabled={busy} className="text-xs">{busy ? '…' : 'Mark complete'}</Btn>
        )}
      </td>
    </tr>
    <Modal open={showSubmit} onClose={() => { setShowSubmit(false); setAttachments([]); }} title={`Submit ${STAGE_LABEL[stage.stageKey]} for ${technical ? 'technical review' : 'approval'}`} size="lg">
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-xs text-blue-900">📅 Submission date will be stamped automatically as <strong>today ({nowIso().slice(0, 10)})</strong>. You can't pick a different date.</div>
      <div className="mb-4">
        <Label>{technical ? 'Technical reviewer' : `Approvers (${approverList.length}) · all must approve`}</Label>
        {approverList.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">⚠ {technical ? 'No dashboard owner assigned · admin must assign one in Manage Dashboards before you can submit.' : 'No approvers assigned to this dashboard. Go to Manage Dashboards (admin) to assign them.'}</div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="text-xs text-gray-500 mb-2">{technical ? `This ${STAGE_LABEL[stage.stageKey]} submission goes to the dashboard owner for technical review. Evidence file required.` : 'Each must individually approve · any rejection sends it back:'}</div>
            <div className="space-y-1">
              {approverList.map(u => {
                const role = state.roles.find(r => r.id === u.roleId);
                return <div key={u.id} className="flex items-center justify-between text-sm"><span>{u.name}</span><Badge tone={technical ? 'navy' : 'blue'}>{role?.name}</Badge></div>;
              })}
            </div>
          </div>
        )}
      </div>
      <Label>{technical ? `Evidence files (required) · ${attachments.length} attached` : `Attachments · ${attachments.length}`}</Label>
      <div className={`border ${technical && attachments.length === 0 ? 'border-amber-300' : 'border-gray-300'} border-dashed rounded p-4 mb-3`}>
        <input type="file" multiple onChange={handleFiles} className="text-xs w-full" />
        {technical && attachments.length === 0 && <div className="text-xs text-amber-700 mt-2">⚠ At least one file is required (model export, SQL script, screenshot, etc.)</div>}
        {attachments.length > 0 && (
          <div className="mt-3 space-y-1">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded px-2 py-1">
                <span className="truncate flex-1">📄 {attachmentName(att)}{typeof att === 'object' && att?.size ? <span className="text-gray-400 ml-2">({formatBytes(att.size)})</span> : null}</span>
                <button onClick={() => setAttachments(attachments.filter((_, x) => x !== i))} className="text-gray-400 hover:text-red-600 ml-2 shrink-0">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">Max {formatBytes(MAX_FILE_BYTES)} per file · files are stored in browser state and downloadable from the review page.</p>
      <div className="flex justify-end gap-2">
        <Btn onClick={() => { setShowSubmit(false); setAttachments([]); }}>Cancel</Btn>
        <Btn variant="primary" onClick={submitForApproval} disabled={busy || approverList.length === 0 || (technical && attachments.length === 0)}>{busy ? 'Submitting…' : technical ? 'Submit for technical review' : 'Submit · stamp today'}</Btn>
      </div>
    </Modal>
  </>;
}

function ApprovalsInbox({ ctx }) {
  const { state, currentUser, currentRole, isAdmin, go } = ctx;
  const myTurn = state.approvals.filter(a => a.status === 'Pending' && isMyTurn(a, currentUser.id));
  const adminCanOverride = isAdmin && currentRole?.permissions?.overrideApprovals;
  const otherPending = adminCanOverride ? state.approvals.filter(a => a.status === 'Pending' && !isMyTurn(a, currentUser.id)) : [];
  const myDecided = state.approvals.filter(a => (a.approverStates || []).some(s => s.approverId === currentUser.id && s.status !== 'Pending'));
  const approvedCount = myDecided.filter(a => (a.approverStates || []).some(s => s.approverId === currentUser.id && s.status === 'Approved')).length;
  const rejectedCount = myDecided.filter(a => (a.approverStates || []).some(s => s.approverId === currentUser.id && s.status === 'Rejected')).length;

  const renderRow = (a) => {
    const days = daysAgo(a.createdAt);
    const priority = days > 3 ? 'high' : days > 1 ? 'medium' : 'low';
    const colors = { high: '#E24B4A', medium: '#BA7517', low: '#1D9E75' };
    const states = a.approverStates || [];
    const active = states.filter(s => s.status !== 'Delegated');
    const approvedN = active.filter(s => s.status === 'Approved').length;
    const totalN = active.length;
    if (a.crId) {
      const cr = state.crs.find(c => c.id === a.crId);
      const dashboard = cr ? state.dashboards.find(d => d.id === cr.dashboardId) : null;
      const crType = cr ? state.crTypes.find(t => t.id === cr.typeId) : null;
      const submitter = cr ? state.users.find(u => u.id === cr.raisedById) : null;
      return (
        <Card key={a.id} style={{ borderLeft: `3px solid ${colors[priority]}` }}>
          <div className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0 pr-4">
              <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                <Badge tone="purple">CR</Badge>
                <span className="font-mono">{cr?.number}</span>
                <span>·</span>
                <span>{crType?.name}</span>
                <span>·</span>
                <span>{days}d waiting</span>
                <span>·</span>
                <Badge tone="blue">{approvedN}/{totalN} approved</Badge>
              </div>
              <div className="text-sm font-medium mt-0.5">{dashboard?.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">Raised by {submitter?.name || '—'} · routes to {STAGE_LABEL[cr?.routedTo]} if all approve</div>
              <div className="text-xs text-gray-600 mt-1 italic truncate">"{cr?.description}"</div>
            </div>
            <Btn variant="primary" onClick={() => go('review', { approvalId: a.id })}>Review →</Btn>
          </div>
        </Card>
      );
    }
    const stage = state.stages.find(s => s.id === a.stageId);
    const dashboard = state.dashboards.find(d => d.id === stage?.dashboardId);
    const submitter = state.users.find(u => u.id === stage?.ownerId);
    return (
      <Card key={a.id} style={{ borderLeft: `3px solid ${colors[priority]}` }}>
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
              <span>{STAGE_LABEL[stage?.stageKey]}</span>
              <span>·</span>
              <span>{days}d waiting</span>
              <span>·</span>
              <span>v{a.version}</span>
              <span>·</span>
              <Badge tone="blue">{approvedN}/{totalN} approved</Badge>
              {(a.attachments || []).length > 0 && <span>· 📎 {a.attachments.length}</span>}
            </div>
            <div className="text-sm font-medium mt-0.5">{dashboard?.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">Submitted by {submitter?.name || '—'}</div>
          </div>
          <Btn variant="primary" onClick={() => go('review', { approvalId: a.id })}>Review →</Btn>
        </div>
      </Card>
    );
  };

  return (
    <div>
      <h1 className="text-xl font-medium">Approval inbox</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">{myTurn.length} pending your decision · {approvedCount} approved by you · {rejectedCount} rejected by you</p>
      {myTurn.length === 0 && otherPending.length === 0 && <Card className="p-12 text-center text-sm text-gray-500">Nothing waiting for your review.<div className="mt-2 text-xs">Submit a stage or raise a CR to populate the inbox.</div></Card>}
      {myTurn.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2 font-medium">Your turn ({myTurn.length})</div>
          <div className="space-y-2 mb-6">{myTurn.map(renderRow)}</div>
        </>
      )}
      {otherPending.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2 font-medium">Waiting on others — admin override view ({otherPending.length})</div>
          <div className="space-y-2">{otherPending.map(renderRow)}</div>
        </>
      )}
    </div>
  );
}

function ReviewPage({ ctx }) {
  const { state, currentUser, currentRole, update, audit, showToast, go, params } = ctx;
  const approval = state.approvals.find(a => a.id === params.approvalId);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showDelegate, setShowDelegate] = useState(false);
  if (!approval) return <div><Btn onClick={() => go('approvals')}>← Back</Btn><p className="text-sm text-gray-500 mt-4">Approval not found.</p></div>;
  if (approval.crId) return <ReviewCrPage ctx={ctx} />;
  const stage = state.stages.find(s => s.id === approval.stageId);
  const dashboard = state.dashboards.find(d => d.id === stage?.dashboardId);
  const submitter = state.users.find(u => u.id === stage?.ownerId);
  const states = approval.approverStates || [];
  const myState = myApproverState(approval, currentUser.id);
  const allowed = myState?.status === 'Pending' || (currentRole?.isAdmin && currentRole?.permissions?.overrideApprovals);
  const history = state.approvals.filter(a => a.stageId === approval.stageId && a.id !== approval.id).sort((a, b) => b.version - a.version);
  const days = daysAgo(approval.createdAt);
  const nextStage = state.stages.filter(s => s.dashboardId === stage.dashboardId && s.stageOrder > stage.stageOrder).sort((a, b) => a.stageOrder - b.stageOrder)[0];
  const attachments = approval.attachments || [];
  const activeStates = states.filter(s => s.status !== 'Delegated');
  const approvedN = activeStates.filter(s => s.status === 'Approved').length;
  const totalN = activeStates.length;

  const decide = async (decision) => {
    setErr(null);
    if (decision === 'reject' && !comment.trim()) { setErr('Comment is required when rejecting.'); return; }
    setBusy(true);
    const { approverStates: newStates, status: newOverallStatus, now } = applyDecision(approval, currentUser.id, decision, comment.trim());
    const becameDecided = approval.status === 'Pending' && newOverallStatus !== 'Pending';
    let updatedApprovals = state.approvals.map(a => a.id === approval.id ? {
      ...a,
      approverStates: newStates,
      status: newOverallStatus,
      decidedAt: becameDecided ? now : a.decidedAt,
      decidedById: becameDecided ? currentUser.id : a.decidedById,
      comment: becameDecided ? (comment.trim() || a.comment) : a.comment
    } : a);
    let updatedStages = [...state.stages];
    let logs = state.auditLog;
    if (decision === 'approve') {
      logs = audit(`approved ${STAGE_LABEL[stage.stageKey]} for ${dashboard.name} · ${approvedN + 1}/${totalN} approvals collected${becameDecided ? ' · STAGE NOW APPROVED' : ''}`, 'Approval', approval.id).auditLog;
      if (becameDecided) {
        updatedStages = updatedStages.map(s => s.id === stage.id ? { ...s, status: 'Approved', approvedAt: now } : s);
        if (nextStage) updatedStages = updatedStages.map(s => s.id === nextStage.id ? { ...s, status: 'In Progress' } : s);
        showToast(`All approvers signed off · ${nextStage ? STAGE_LABEL[nextStage.stageKey] + ' now in progress' : 'Dashboard fully approved'}`);
      } else {
        const remaining = totalN - approvedN - 1;
        showToast(`Your approval recorded · ${remaining} more approver${remaining === 1 ? '' : 's'} needed`);
      }
    } else {
      const newCount = stage.rebuildCount + 1;
      const escalated = newCount >= REBUILD_THRESHOLD;
      updatedStages = updatedStages.map(s => s.id === stage.id ? { ...s, status: 'Rejected', rebuildCount: newCount, escalated, submittedAt: null, actualDate: null } : s);
      logs = audit(`rejected ${STAGE_LABEL[stage.stageKey]} for ${dashboard.name}${escalated ? ' (ESCALATED to D&A Lead)' : ''}`, 'Approval', approval.id, { rebuildCount: newCount, comment }).auditLog;
      showToast(escalated ? `Rejected · ${newCount}× rebuilds · escalated to D&A Lead` : `Rejected · ${newCount}× rebuilds so far`, escalated ? 'warn' : 'success');
    }
    await update({ ...state, approvals: updatedApprovals, stages: updatedStages, auditLog: logs });
    setBusy(false);
    go('approvals');
  };

  const onDelegate = async (toUserId, reason) => {
    const result = applyDelegation(approval, currentUser.id, toUserId, reason);
    if (result.error) { showToast(result.error, 'error'); return; }
    const newApproverIds = [...new Set([...(approval.approverIds || []), toUserId])];
    const toName = state.users.find(u => u.id === toUserId)?.name || 'user';
    const updatedApprovals = state.approvals.map(a => a.id === approval.id ? { ...a, approverStates: result.approverStates, status: result.status, approverIds: newApproverIds } : a);
    const logs = audit(`delegated ${STAGE_LABEL[stage.stageKey]} approval for ${dashboard.name} to ${toName}${reason ? ' · ' + reason : ''}`, 'Approval', approval.id).auditLog;
    await update({ ...state, approvals: updatedApprovals, auditLog: logs });
    showToast(`Delegated to ${toName}`);
    setShowDelegate(false);
    go('approvals');
  };

  return (
    <div>
      <button onClick={() => go('approvals')} className="text-sm text-gray-500 hover:text-[#1F2D5A] mb-3 inline-block">← Back to inbox</button>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">{STAGE_LABEL[stage.stageKey]} review · v{approval.version}</div>
          <h1 className="text-xl font-medium mt-1">{dashboard.name}</h1>
          <div className="text-xs text-gray-500 mt-1">{dashboard.domain} · Tier {dashboard.tier}</div>
        </div>
        <div className="text-right">
          <Badge tone={approval.status === 'Approved' ? 'green' : approval.status === 'Rejected' ? 'red' : 'amber'}>{approval.status}</Badge>
          <div className="text-xs text-gray-500 mt-1">{approvedN}/{totalN} approved</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3">Submitted artifacts ({attachments.length})</h3>
            {attachments.length === 0 ? (
              <div className="text-xs text-gray-500 italic border border-dashed border-gray-300 rounded p-6 text-center">No files attached.</div>
            ) : (
              <div>
                {attachments.map((att, i) => (
                  <button
                    key={i}
                    onClick={() => downloadAttachment(att, showToast)}
                    title={typeof att === 'string' ? 'Legacy attachment — no content stored' : 'Click to download'}
                    className="inline-flex items-center gap-2 text-sm border border-gray-200 rounded px-3 py-2 bg-gray-50 hover:bg-blue-50 hover:border-[#1F2D5A] mr-2 mb-2 transition group"
                  >
                    <span className="text-[#1F2D5A] font-medium">📄 {attachmentName(att)}</span>
                    {typeof att === 'object' && att?.size ? <span className="text-xs text-gray-500">{formatBytes(att.size)}</span> : null}
                    <span className="text-xs text-gray-400 group-hover:text-[#1F2D5A]">{typeof att === 'string' ? '⚠' : '⬇'}</span>
                  </button>
                ))}
                <p className="text-xs text-gray-500 mt-2">Click any file to download.</p>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs space-y-1">
              <div><span className="text-gray-500">Submitted by:</span> {submitter?.name || 'Unknown'}</div>
              <div><span className="text-gray-500">Submitted on:</span> {fmtDateTime(approval.createdAt)}</div>
              <div><span className="text-gray-500">Days waiting:</span> <span className={days > 3 ? 'text-red-700 font-medium' : ''}>{days}</span></div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3">Approval cycle ({approvedN}/{totalN} approved · each must approve)</h3>
            <div className="space-y-2">
              {states.map((s, idx) => <ApproverStateRow key={idx} state={state} st={s} isMe={s.approverId === currentUser.id} />)}
            </div>
          </Card>
          {history.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-medium mb-3">History ({history.length} previous version{history.length > 1 ? 's' : ''})</h3>
              <div className="space-y-2">
                {history.map(h => {
                  const hStates = h.approverStates || [];
                  const finalDeciderState = hStates.find(s => s.status === h.status);
                  const finalDecider = finalDeciderState ? state.users.find(u => u.id === finalDeciderState.approverId) : (h.decidedById ? state.users.find(u => u.id === h.decidedById) : null);
                  return (
                    <div key={h.id} className="text-xs border-l-2 pl-3 py-1" style={{ borderColor: h.status === 'Rejected' ? '#E24B4A' : '#1D9E75' }}>
                      <div><strong>v{h.version}</strong> · <Badge tone={h.status === 'Rejected' ? 'red' : 'green'}>{h.status}</Badge> {finalDecider ? `${h.status === 'Rejected' ? 'by ' : 'finalised by '}${finalDecider.name}` : ''} on {h.decidedAt && fmtDate(h.decidedAt)}</div>
                      {h.comment && <div className="text-gray-600 mt-1">{h.comment}</div>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
        <div>
          <Card className="p-5 sticky top-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your decision</div>
            {approval.status === 'Pending' && allowed && myState?.status === 'Pending' && (
              <>
                <Label>Comment {comment.length === 0 && '(required for reject)'}</Label>
                <TextArea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Provide feedback…" className="mb-3" />
                {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{err}</div>}
                <div className="flex flex-col gap-2">
                  <Btn variant="success" onClick={() => decide('approve')} disabled={busy}>✓ Approve</Btn>
                  <Btn variant="danger" onClick={() => decide('reject')} disabled={busy}>↩ Reject</Btn>
                  <Btn onClick={() => setShowDelegate(true)} disabled={busy}>↪ Delegate to someone else</Btn>
                </div>
                {totalN > 1 && <p className="text-xs text-gray-500 mt-3">All {totalN} approvers must approve before this stage advances. Any rejection ends the cycle.</p>}
              </>
            )}
            {approval.status === 'Pending' && allowed && myState?.status !== 'Pending' && (
              <div className="text-sm text-gray-600">You already <strong>{myState.status === 'Approved' ? 'approved' : myState.status === 'Rejected' ? 'rejected' : 'delegated'}</strong> this. Waiting on the others.</div>
            )}
            {approval.status === 'Pending' && !allowed && (
              <div className="text-sm text-gray-600">You're not on this approval cycle. Switch to one of the listed approvers in the top bar to act.</div>
            )}
            {approval.status !== 'Pending' && (
              <div className="space-y-2 text-sm">
                <Badge tone={approval.status === 'Approved' ? 'green' : 'red'}>{approval.status}</Badge>
                <div className="text-xs text-gray-500">Final decision on {fmtDateTime(approval.decidedAt)}</div>
                {approval.comment && <div className="text-gray-600 text-xs mt-2 bg-gray-50 rounded p-2">{approval.comment}</div>}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">If all approve · next</div>
              <div className="text-xs">{nextStage ? `${STAGE_LABEL[nextStage.stageKey]} → ${state.users.find(u => u.id === nextStage.ownerId)?.name || 'unassigned'}` : 'Dashboard goes live'}</div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">If any reject</div>
              <div className="text-xs">Counter +1, artifact reopens. At {REBUILD_THRESHOLD} rebuilds, escalates to D&A Lead.</div>
            </div>
            <div className="mt-4 text-xs text-gray-500">Current rebuilds: <span className={stage.rebuildCount >= 2 ? 'text-red-700 font-medium' : ''}>{stage.rebuildCount}</span> / {REBUILD_THRESHOLD}</div>
          </Card>
        </div>
      </div>
      {showDelegate && <DelegateModal state={state} approval={approval} currentUserId={currentUser.id} onClose={() => setShowDelegate(false)} onDelegate={onDelegate} />}
    </div>
  );
}

function ApproverStateRow({ state, st, isMe }) {
  const user = state.users.find(u => u.id === st.approverId);
  const role = user ? state.roles.find(r => r.id === user.roleId) : null;
  const delegatedFrom = st.delegatedFromId ? state.users.find(u => u.id === st.delegatedFromId) : null;
  const delegatedTo = st.delegatedToId ? state.users.find(u => u.id === st.delegatedToId) : null;
  const tones = { Approved: 'green', Rejected: 'red', Pending: 'amber', Delegated: 'gray' };
  const icons = { Approved: '✓ Approved', Rejected: '✗ Rejected', Pending: 'Pending', Delegated: '↪ Delegated' };
  return (
    <div className={`flex items-start justify-between text-sm border rounded px-3 py-2 ${isMe ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{user?.name || 'Unknown'}</span>
          <span className="text-xs text-gray-500">({role?.name})</span>
          {isMe && <Badge tone="blue">you</Badge>}
          {delegatedFrom && <span className="text-xs text-gray-500">· delegated from {delegatedFrom.name}</span>}
        </div>
        {st.comment && <div className="text-xs text-gray-600 mt-1 italic">"{st.comment}"</div>}
        {st.decidedAt && <div className="text-xs text-gray-400 mt-1">{fmtDateTime(st.decidedAt)}</div>}
        {delegatedTo && <div className="text-xs text-gray-500 mt-1">→ now with {delegatedTo.name}</div>}
      </div>
      <Badge tone={tones[st.status] || 'gray'}>{icons[st.status] || st.status}</Badge>
    </div>
  );
}

function DelegateModal({ state, approval, currentUserId, onClose, onDelegate }) {
  const [toUserId, setToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const inCycle = new Set((approval.approverStates || []).filter(s => s.status !== 'Delegated').map(s => s.approverId));
  const candidates = state.users.filter(u => u.status === 'Active' && u.id !== currentUserId && !inCycle.has(u.id));
  const submit = async () => {
    if (!toUserId) return;
    setBusy(true);
    await onDelegate(toUserId, reason.trim());
    setBusy(false);
  };
  return (
    <Modal open={true} onClose={onClose} title="Delegate this approval">
      <p className="text-sm text-gray-600 mb-4">Pass your responsibility to someone else. The new person becomes a required approver in your place. The other approvers' decisions are unchanged.</p>
      <Label>Assign to</Label>
      <Select value={toUserId} onChange={e => setToUserId(e.target.value)} className="mb-3">
        <option value="">— Pick a user —</option>
        {candidates.map(u => { const r = state.roles.find(x => x.id === u.roleId); return <option key={u.id} value={u.id}>{u.name} ({r?.name})</option>; })}
      </Select>
      {candidates.length === 0 && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">No eligible users · everyone is either inactive, you, or already in this cycle.</div>}
      <Label>Reason (optional, visible in audit log)</Label>
      <TextArea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="e.g. on leave until Sunday · Mohammed is covering" className="mb-4" />
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={busy || !toUserId}>{busy ? 'Delegating…' : 'Delegate'}</Btn>
      </div>
    </Modal>
  );
}

function ReviewCrPage({ ctx }) {
  const { state, currentUser, currentRole, update, audit, showToast, go, params } = ctx;
  const approval = state.approvals.find(a => a.id === params.approvalId);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showDelegate, setShowDelegate] = useState(false);
  if (!approval || !approval.crId) return <div><Btn onClick={() => go('approvals')}>← Back</Btn><p className="text-sm text-gray-500 mt-4">CR approval not found.</p></div>;
  const cr = state.crs.find(c => c.id === approval.crId);
  if (!cr) return <div><Btn onClick={() => go('approvals')}>← Back</Btn><p className="text-sm text-gray-500 mt-4">CR record missing.</p></div>;
  const dashboard = state.dashboards.find(d => d.id === cr.dashboardId);
  const crType = state.crTypes.find(t => t.id === cr.typeId);
  const submitter = state.users.find(u => u.id === cr.raisedById);
  const states = approval.approverStates || [];
  const myState = myApproverState(approval, currentUser.id);
  const allowed = myState?.status === 'Pending' || (currentRole?.isAdmin && currentRole?.permissions?.overrideApprovals);
  const targetStage = state.stages.find(s => s.dashboardId === cr.dashboardId && s.stageKey === cr.routedTo);
  const days = daysAgo(approval.createdAt);
  const activeStates = states.filter(s => s.status !== 'Delegated');
  const approvedN = activeStates.filter(s => s.status === 'Approved').length;
  const totalN = activeStates.length;
  const requesterId = dashboard?.requesterId;
  const requesterState = requesterId ? states.find(s => s.approverId === requesterId && s.status !== 'Delegated') : null;

  const decide = async (decision) => {
    setErr(null);
    if (decision === 'reject' && !comment.trim()) { setErr('Comment is required when declining.'); return; }
    setBusy(true);
    const { approverStates: newStates, status: newOverallStatus, now } = applyDecision(approval, currentUser.id, decision, comment.trim());
    const becameDecided = approval.status === 'Pending' && newOverallStatus !== 'Pending';
    let updatedApprovals = state.approvals.map(a => a.id === approval.id ? {
      ...a, approverStates: newStates, status: newOverallStatus,
      decidedAt: becameDecided ? now : a.decidedAt,
      decidedById: becameDecided ? currentUser.id : a.decidedById,
      comment: becameDecided ? (comment.trim() || a.comment) : a.comment
    } : a);
    let updatedCrs = [...state.crs];
    let updatedStages = [...state.stages];
    let logs = state.auditLog;
    if (decision === 'approve') {
      if (becameDecided) {
        updatedCrs = updatedCrs.map(c => c.id === cr.id ? { ...c, status: 'Approved', resolution: 'approved · stage reopened', closedAt: now } : c);
        if (targetStage) updatedStages = updatedStages.map(s => s.id === targetStage.id ? { ...s, status: 'In Progress', actualDate: null, submittedAt: null } : s);
        logs = audit(`approved ${cr.number} for ${dashboard.name} · all approvers signed off · reopened ${STAGE_LABEL[cr.routedTo]}`, 'ChangeRequest', cr.id).auditLog;
        showToast(`${cr.number} approved · ${STAGE_LABEL[cr.routedTo]} reopened for rebuild`);
      } else {
        const remaining = totalN - approvedN - 1;
        logs = audit(`approved ${cr.number} for ${dashboard.name} · ${approvedN + 1}/${totalN} collected`, 'ChangeRequest', cr.id).auditLog;
        showToast(`Your approval recorded · ${remaining} more approver${remaining === 1 ? '' : 's'} needed`);
      }
    } else {
      updatedCrs = updatedCrs.map(c => c.id === cr.id ? { ...c, status: 'Declined', resolution: 'declined', closedAt: now } : c);
      logs = audit(`declined ${cr.number} for ${dashboard.name}`, 'ChangeRequest', cr.id).auditLog;
      showToast(`${cr.number} declined · no stage changes`, 'warn');
    }
    await update({ ...state, approvals: updatedApprovals, crs: updatedCrs, stages: updatedStages, auditLog: logs });
    setBusy(false);
    go('approvals');
  };

  const onDelegate = async (toUserId, reason) => {
    const result = applyDelegation(approval, currentUser.id, toUserId, reason);
    if (result.error) { showToast(result.error, 'error'); return; }
    const newApproverIds = [...new Set([...(approval.approverIds || []), toUserId])];
    const toName = state.users.find(u => u.id === toUserId)?.name || 'user';
    const updatedApprovals = state.approvals.map(a => a.id === approval.id ? { ...a, approverStates: result.approverStates, status: result.status, approverIds: newApproverIds } : a);
    const logs = audit(`delegated ${cr.number} CR approval for ${dashboard.name} to ${toName}${reason ? ' · ' + reason : ''}`, 'ChangeRequest', cr.id).auditLog;
    await update({ ...state, approvals: updatedApprovals, auditLog: logs });
    showToast(`Delegated to ${toName}`);
    setShowDelegate(false);
    go('approvals');
  };

  return (
    <div>
      <button onClick={() => go('approvals')} className="text-sm text-gray-500 hover:text-[#1F2D5A] mb-3 inline-block">← Back to inbox</button>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-2"><Badge tone="purple">Change Request</Badge> <span className="font-mono">{cr.number}</span></div>
          <h1 className="text-xl font-medium mt-1">{dashboard?.name}</h1>
          <div className="text-xs text-gray-500 mt-1">{dashboard?.domain} · Tier {dashboard?.tier} · Routes to <strong>{STAGE_LABEL[cr.routedTo]}</strong> if all approve</div>
        </div>
        <div className="text-right">
          <Badge tone={approval.status === 'Approved' ? 'green' : approval.status === 'Rejected' ? 'red' : 'amber'}>{approval.status === 'Rejected' ? 'Declined' : approval.status}</Badge>
          <div className="text-xs text-gray-500 mt-1">{approvedN}/{totalN} approved</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3">Change request</h3>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-2 text-gray-500 w-32">Type</td><td className="py-2"><Badge tone="purple">{crType?.name}</Badge></td></tr>
                <tr><td className="py-2 text-gray-500">Routes to</td><td className="py-2"><Badge tone="blue">{STAGE_LABEL[cr.routedTo]}</Badge></td></tr>
                <tr><td className="py-2 text-gray-500">Priority</td><td className="py-2"><Badge tone={cr.priority === 'High' ? 'red' : cr.priority === 'Medium' ? 'amber' : 'gray'}>{cr.priority}</Badge></td></tr>
                <tr><td className="py-2 text-gray-500">Raised by</td><td className="py-2 text-sm">{submitter?.name || 'Unknown'}</td></tr>
                <tr><td className="py-2 text-gray-500">Raised on</td><td className="py-2 text-xs text-gray-600">{fmtDateTime(cr.createdAt)}</td></tr>
                <tr><td className="py-2 text-gray-500">Waiting</td><td className="py-2 text-xs text-gray-600"><span className={days > 3 ? 'text-red-700 font-medium' : ''}>{days} day{days !== 1 ? 's' : ''}</span></td></tr>
              </tbody>
            </table>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</div>
              <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-wrap">{cr.description}</p>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3">Approval cycle ({approvedN}/{totalN} approved · each must approve)</h3>
            {requesterState && <p className="text-xs text-gray-500 mb-3">{state.users.find(u => u.id === requesterId)?.name} is the dashboard requester · automatically included.</p>}
            <div className="space-y-2">
              {states.map((s, idx) => <ApproverStateRow key={idx} state={state} st={s} isMe={s.approverId === currentUser.id} />)}
            </div>
          </Card>
          {targetStage && (
            <Card className="p-5">
              <h3 className="text-sm font-medium mb-3">Target stage (if all approve)</h3>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <Badge tone="blue">{STAGE_LABEL[targetStage.stageKey]}</Badge>
                <span className="text-gray-500">Current status:</span>
                <Badge tone={statusTone(targetStage.status)}>{targetStage.status}</Badge>
                <span className="text-gray-500 ml-3">Owner:</span>
                <span>{state.users.find(u => u.id === targetStage.ownerId)?.name || '—'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-3">On full approval, this stage's status will be set to <strong>In Progress</strong> and the owner will rebuild and re-submit through the normal gate.</p>
              {targetStage.status === 'Pending Approval' && <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">⚠ Target stage currently has a pending approval. Approving this CR will reset it to In Progress; the existing pending approval will become stale.</div>}
            </Card>
          )}
        </div>
        <div>
          <Card className="p-5 sticky top-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your decision</div>
            {approval.status === 'Pending' && allowed && myState?.status === 'Pending' && (
              <>
                <Label>Comment {comment.length === 0 && '(required for decline)'}</Label>
                <TextArea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Provide context…" className="mb-3" />
                {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{err}</div>}
                <div className="flex flex-col gap-2">
                  <Btn variant="success" onClick={() => decide('approve')} disabled={busy}>✓ Approve</Btn>
                  <Btn variant="danger" onClick={() => decide('reject')} disabled={busy}>↩ Decline</Btn>
                  <Btn onClick={() => setShowDelegate(true)} disabled={busy}>↪ Delegate to someone else</Btn>
                </div>
                {totalN > 1 && <p className="text-xs text-gray-500 mt-3">All {totalN} approvers must approve before the routed stage reopens.</p>}
              </>
            )}
            {approval.status === 'Pending' && allowed && myState?.status !== 'Pending' && (
              <div className="text-sm text-gray-600">You already <strong>{myState.status === 'Approved' ? 'approved' : myState.status === 'Rejected' ? 'declined' : 'delegated'}</strong>. Waiting on the others.</div>
            )}
            {approval.status === 'Pending' && !allowed && (
              <div className="text-sm text-gray-600">You're not on this approval cycle. Switch to one of the listed approvers in the top bar.</div>
            )}
            {approval.status !== 'Pending' && (
              <div className="space-y-2 text-sm">
                <Badge tone={approval.status === 'Approved' ? 'green' : 'red'}>{approval.status === 'Approved' ? 'Approved' : 'Declined'}</Badge>
                <div className="text-xs text-gray-500">Final decision on {fmtDateTime(approval.decidedAt)}</div>
                {approval.comment && <div className="text-gray-600 text-xs mt-2 bg-gray-50 rounded p-2">{approval.comment}</div>}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">If all approve</div>
              <div className="text-xs">{targetStage ? `${STAGE_LABEL[cr.routedTo]} reopens · status → In Progress · actual date cleared` : '⚠ no matching target stage on this dashboard'}</div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">If any declines</div>
              <div className="text-xs">CR closed · resolution: declined · no stage changes</div>
            </div>
          </Card>
        </div>
      </div>
      {showDelegate && <DelegateModal state={state} approval={approval} currentUserId={currentUser.id} onClose={() => setShowDelegate(false)} onDelegate={onDelegate} />}
    </div>
  );
}

function DashboardsCatalog({ ctx }) {
  const { state, currentUser, currentRole, go, params } = ctx;
  const [showAdd, setShowAdd] = useState(false);
  const visible = state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d));
  const isAdmin = !!currentRole?.isAdmin;
  const activeCategory = params.category || null;

  if (!activeCategory) {
    const categoriesMap = {};
    visible.forEach(d => {
      const c = d.domain || 'Uncategorized';
      if (!categoriesMap[c]) categoriesMap[c] = { name: c, count: 0, p1: 0, p2: 0, p3: 0, completedCount: 0, totalStages: 0, doneStages: 0 };
      categoriesMap[c].count++;
      categoriesMap[c][d.tier.toLowerCase()]++;
      const stages = state.stages.filter(s => s.dashboardId === d.id);
      categoriesMap[c].totalStages += stages.length;
      categoriesMap[c].doneStages += stages.filter(s => s.actualDate).length;
      if (stages.every(s => s.actualDate)) categoriesMap[c].completedCount++;
    });
    const categories = Object.values(categoriesMap).sort((a, b) => b.count - a.count);
    const totalVisible = visible.length;
    return (
      <div>
        <div className="flex justify-between items-start mb-5">
          <div>
            <h1 className="text-xl font-medium">Dashboards</h1>
            <p className="text-sm text-gray-500 mt-1">{totalVisible} dashboard{totalVisible === 1 ? '' : 's'} across {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}{visible.length < state.dashboards.length ? ` · scoped to your access` : ''}</p>
          </div>
          {isAdmin && <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add dashboard</Btn>}
        </div>
        {categories.length === 0 ? (
          <Card className="p-12 text-center text-sm text-gray-500">No dashboards visible to you. Ask an admin to add you as owner, requester, or approver, or to expand your scope.</Card>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {categories.map(c => {
              const pct = c.totalStages === 0 ? 0 : Math.round((c.doneStages / c.totalStages) * 100);
              return (
                <button key={c.name} onClick={() => go('dashboards', { category: c.name })} className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-[#1F2D5A] hover:shadow-md transition group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Category</div>
                      <div className="text-base font-medium mt-1 group-hover:text-[#1F2D5A]">{c.name}</div>
                    </div>
                    <div className="text-2xl font-medium text-[#1F2D5A]">{c.count}</div>
                  </div>
                  <div className="flex gap-1 mb-3 flex-wrap">
                    {c.p1 > 0 && <Badge tone="red">{c.p1} P1</Badge>}
                    {c.p2 > 0 && <Badge tone="amber">{c.p2} P2</Badge>}
                    {c.p3 > 0 && <Badge tone="gray">{c.p3} P3</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-full bg-[#1F2D5A]" style={{ width: `${pct}%` }}></div></div>
                    <span className="text-xs text-gray-500 w-12 text-right">{pct}%</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">{c.completedCount}/{c.count} fully delivered</div>
                </button>
              );
            })}
          </div>
        )}
        {showAdd && <AddDashboardModal ctx={ctx} onClose={() => setShowAdd(false)} />}
      </div>
    );
  }

  const inCategory = visible.filter(d => (d.domain || 'Uncategorized') === activeCategory);
  const enriched = inCategory.map(d => {
    const stages = state.stages.filter(s => s.dashboardId === d.id);
    const completed = stages.filter(s => s.actualDate).length;
    const current = stages.find(s => s.status === 'In Progress' || s.status === 'Pending Approval');
    return { ...d, completed, current, pct: Math.round((completed / stages.length) * 100) };
  });
  return (
    <div>
      <button onClick={() => go('dashboards')} className="text-sm text-gray-500 hover:text-[#1F2D5A] mb-3 inline-block">← All categories</button>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-medium">{activeCategory} dashboards</h1>
          <p className="text-sm text-gray-500 mt-1">{inCategory.length} dashboard{inCategory.length === 1 ? '' : 's'} in this category</p>
        </div>
        {isAdmin && <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add dashboard</Btn>}
      </div>
      {enriched.length === 0 ? (
        <Card className="p-12 text-center text-sm text-gray-500">No dashboards in {activeCategory}.</Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-left px-4 py-3 font-medium">Owner</th>
                <th className="text-left px-4 py-3 font-medium">Requester</th>
                <th className="text-left px-4 py-3 font-medium">Approvers</th>
                <th className="text-left px-4 py-3 font-medium">Current</th>
                <th className="text-left px-4 py-3 font-medium">Progress</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enriched.map(d => {
                const approvers = (d.approverIds || []).map(id => state.users.find(u => u.id === id)).filter(Boolean);
                const owner = d.ownerId ? state.users.find(u => u.id === d.ownerId) : null;
                const requester = d.requesterId ? state.users.find(u => u.id === d.requesterId) : null;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-gray-500">{d.num}</td>
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3"><Badge tone={d.tier === 'P1' ? 'red' : d.tier === 'P2' ? 'amber' : 'gray'}>{d.tier}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{owner?.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{requester?.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{approvers.length === 0 ? <span className="text-amber-700">⚠ none</span> : approvers.length === 1 ? approvers[0].name : `${approvers.length} approvers`}</td>
                    <td className="px-4 py-3 text-xs">{d.current ? STAGE_LABEL[d.current.stageKey] : <span className="text-gray-400">Not started</span>}</td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded overflow-hidden"><div className="h-full bg-[#1F2D5A]" style={{ width: `${d.pct}%` }}></div></div>
                        <span className="text-xs text-gray-500 w-8">{d.pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right"><Btn onClick={() => go('dashboard-detail', { dashboardId: d.id })} className="text-xs">Open</Btn></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {showAdd && <AddDashboardModal ctx={ctx} prefillCategory={activeCategory} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddDashboardModal({ ctx, onClose, prefillCategory = '', editing = null }) {
  const isEditing = !!editing;
  const { state, update, audit, showToast } = ctx;
  const [name, setName] = useState(editing?.name || '');
  const [category, setCategory] = useState(editing?.domain || prefillCategory);
  const [newCategory, setNewCategory] = useState('');
  const [tier, setTier] = useState(editing?.tier || 'P2');
  const [ownerId, setOwnerId] = useState(editing?.ownerId || '');
  const [requesterId, setRequesterId] = useState(editing?.requesterId || '');
  const [approverIds, setApproverIds] = useState(editing?.approverIds || []);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const existingCategories = [...new Set(state.dashboards.map(d => d.domain).filter(Boolean))].sort();
  const ownerCandidates = state.users.filter(u => u.status === 'Active');
  const approverCandidates = state.users.filter(u => {
    if (u.status !== 'Active') return false;
    const role = state.roles.find(r => r.id === u.roleId);
    const p = role?.permissions || {};
    return p.approveBrd || p.approveDesign || p.signoffUat || role?.isAdmin;
  });

  const toggleApprover = (id) => setApproverIds(approverIds.includes(id) ? approverIds.filter(x => x !== id) : [...approverIds, id]);

  const submit = async () => {
    setErr(null);
    const finalCategory = (category === '__new__' ? newCategory.trim() : category.trim());
    if (!name.trim()) { setErr('Name is required'); return; }
    if (!finalCategory) { setErr('Category is required'); return; }
    setBusy(true);
    if (isEditing) {
      const oldName = editing.name;
      const oldCat = editing.domain;
      const changes = [];
      if (oldName !== name.trim()) changes.push(`name: "${oldName}" → "${name.trim()}"`);
      if (oldCat !== finalCategory) changes.push(`category: ${oldCat} → ${finalCategory}`);
      if (editing.tier !== tier) changes.push(`tier: ${editing.tier} → ${tier}`);
      if ((editing.ownerId || null) !== (ownerId || null)) changes.push('owner changed');
      if ((editing.requesterId || null) !== (requesterId || null)) changes.push('requester changed');
      const oldApprovers = (editing.approverIds || []).slice().sort().join(',');
      const newApprovers = approverIds.slice().sort().join(',');
      if (oldApprovers !== newApprovers) changes.push(`approvers: ${editing.approverIds?.length || 0} → ${approverIds.length}`);
      const dashboards = state.dashboards.map(d => d.id === editing.id ? {
        ...d, name: name.trim(), domain: finalCategory, tier,
        ownerId: ownerId || null, requesterId: requesterId || null,
        approverIds: [...approverIds]
      } : d);
      const summary = changes.length === 0 ? 'no changes' : changes.join(' · ');
      const logs = audit(`edited dashboard "${oldName}" · ${summary}`, 'Dashboard', editing.id).auditLog;
      await update({ ...state, dashboards, auditLog: logs });
      showToast(changes.length === 0 ? 'No changes to save' : `Dashboard saved · ${changes.length} field${changes.length === 1 ? '' : 's'} updated`);
      setBusy(false); onClose();
      return;
    }
    const newNum = (state.dashboards.reduce((m, d) => Math.max(m, d.num || 0), 0)) + 1;
    const dashId = genId();
    const dashboard = {
      id: dashId, num: newNum, name: name.trim(), domain: finalCategory, tier,
      approverIds: [...approverIds], ownerId: ownerId || null, requesterId: requesterId || null,
      status: 'Planning'
    };
    const newStages = STAGE_KEYS.map((key, idx) => ({
      id: genId(), dashboardId: dashId, stageKey: key, stageOrder: idx + 1,
      ownerId: defaultStageOwner(state, key, ownerId || null),
      plannedDate: null, actualDate: null, rebuildCount: 0, escalated: false,
      status: 'Not Started', submittedAt: null, approvedAt: null, createdAt: nowIso()
    }));
    const logs = audit(`created dashboard "${dashboard.name}" in ${finalCategory} (#${newNum}) · ${approverIds.length} approver${approverIds.length === 1 ? '' : 's'}`, 'Dashboard', dashId).auditLog;
    await update({ ...state, dashboards: [...state.dashboards, dashboard], stages: [...state.stages, ...newStages], auditLog: logs });
    showToast(`Dashboard #${newNum} created in ${finalCategory}`);
    setBusy(false); onClose();
  };

  return (
    <Modal open={true} onClose={onClose} title={isEditing ? `Edit dashboard · #${editing.num}` : "Create new dashboard"} size="lg">
      <Label>Dashboard name</Label>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Procurement — Supplier Risk" className="mb-3" autoFocus />
      <Label>Category</Label>
      <Select value={category} onChange={e => setCategory(e.target.value)} className="mb-3">
        <option value="">— Select category —</option>
        {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
        <option value="__new__">+ Create new category…</option>
      </Select>
      {category === '__new__' && <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="New category name (e.g. Marketing)" className="mb-3" />}
      <Label>Tier</Label>
      <Select value={tier} onChange={e => setTier(e.target.value)} className="mb-3">
        <option value="P1">P1 · Critical</option>
        <option value="P2">P2 · Important</option>
        <option value="P3">P3 · Nice-to-have</option>
      </Select>
      <Label>Owner (D&A point of contact, builds and coordinates)</Label>
      <Select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="mb-3">
        <option value="">— None —</option>
        {ownerCandidates.map(u => { const r = state.roles.find(x => x.id === u.roleId); return <option key={u.id} value={u.id}>{u.name} ({r?.name})</option>; })}
      </Select>
      <Label>Requester (business person who asked for it)</Label>
      <Select value={requesterId} onChange={e => setRequesterId(e.target.value)} className="mb-4">
        <option value="">— None —</option>
        {ownerCandidates.map(u => { const r = state.roles.find(x => x.id === u.roleId); return <option key={u.id} value={u.id}>{u.name} ({r?.name})</option>; })}
      </Select>
      <Label>Approvers ({approverIds.length} selected) · all must approve BRD, Design, UAT</Label>
      <div className="border border-gray-200 rounded max-h-56 overflow-y-auto mb-4">
        {approverCandidates.length === 0 && <div className="p-3 text-xs text-gray-500 text-center">No users with approve permissions. Add users with Sponsor or Data Owner role first.</div>}
        {approverCandidates.map(u => {
          const role = state.roles.find(r => r.id === u.roleId);
          const checked = approverIds.includes(u.id);
          return (
            <label key={u.id} className={`flex items-center gap-3 p-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleApprover(u.id)} className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              <Badge tone="blue">{role?.name}</Badge>
            </label>
          );
        })}
      </div>
      {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{err}</div>}
      {!isEditing && (
        <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-600 mb-4">
          <div className="font-medium text-gray-800 mb-1">What happens next:</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>7 stages are created (BRD → Production), auto-assigned to the team based on role</li>
            <li>Only the Owner, Requester, Approvers and users scoped to this category will see this dashboard</li>
            <li>Admins always see everything</li>
          </ul>
        </div>
      )}
      {isEditing && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 mb-4">
          <div className="font-medium mb-1">Note on edits:</div>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Stage owners are <strong>not</strong> automatically reassigned when you change the dashboard owner — adjust stage owners separately if needed.</li>
            <li>Editing the approver list does <strong>not</strong> affect in-flight approvals — those keep the approver list they were submitted with.</li>
            <li>Changes are logged in the audit log.</li>
          </ul>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={submit} disabled={busy}>{busy ? (isEditing ? 'Saving…' : 'Creating…') : (isEditing ? 'Save changes' : 'Create dashboard')}</Btn>
      </div>
    </Modal>
  );
}

function DashboardDetail({ ctx }) {
  const { state, currentUser, currentRole, update, audit, showToast, go, params } = ctx;
  const dashboard = state.dashboards.find(d => d.id === params.dashboardId);
  const [editingApprovers, setEditingApprovers] = useState(false);
  if (!dashboard) return <div><Btn onClick={() => go('dashboards')}>← Back</Btn></div>;
  if (!canViewDashboard(currentUser, currentRole, dashboard)) {
    return (
      <div>
        <Btn onClick={() => go('dashboards')}>← Back to dashboards</Btn>
        <Card className="p-12 text-center text-sm text-gray-500 mt-4">
          <div className="text-3xl mb-2">🔒</div>
          <div className="font-medium text-gray-700 mb-1">You don't have access to this dashboard</div>
          <div className="text-xs">It's outside your category scope, and you're not listed as owner, requester, or approver. Ask an admin to expand your scope or add you to this dashboard.</div>
        </Card>
      </div>
    );
  }
  const stages = state.stages.filter(s => s.dashboardId === dashboard.id).sort((a, b) => a.stageOrder - b.stageOrder);
  const approvers = (dashboard.approverIds || []).map(id => state.users.find(u => u.id === id)).filter(Boolean);
  const owner = dashboard.ownerId ? state.users.find(u => u.id === dashboard.ownerId) : null;
  const requester = dashboard.requesterId ? state.users.find(u => u.id === dashboard.requesterId) : null;
  const completed = stages.filter(s => s.actualDate).length;
  const pct = Math.round((completed / stages.length) * 100);
  const approvals = state.approvals.filter(a => stages.some(s => s.id === a.stageId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const crs = state.crs.filter(c => c.dashboardId === dashboard.id);

  const saveApprovers = async (ids) => {
    const updated = state.dashboards.map(d => d.id === dashboard.id ? { ...d, approverIds: ids } : d);
    const logs = audit(`updated approvers for ${dashboard.name} (${ids.length} total)`, 'Dashboard', dashboard.id).auditLog;
    await update({ ...state, dashboards: updated, auditLog: logs });
    showToast(`Approvers saved · ${ids.length} on the list`); setEditingApprovers(false);
  };

  return (
    <div>
      <button onClick={() => go('dashboards', { category: dashboard.domain })} className="text-sm text-gray-500 hover:text-[#1F2D5A] mb-3 inline-block">← Back to {dashboard.domain}</button>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-xs text-gray-500 flex items-center gap-2">Dashboard #{dashboard.num} <Badge tone="gray">{dashboard.domain}</Badge></div>
          <h1 className="text-xl font-medium mt-1">{dashboard.name}</h1>
          <div className="text-xs text-gray-500 mt-1">Tier {dashboard.tier} · {pct}% complete</div>
        </div>
        <Badge tone={dashboard.tier === 'P1' ? 'red' : dashboard.tier === 'P2' ? 'amber' : 'gray'}>{dashboard.tier}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Owner</div>
          <div className="text-sm font-medium mt-1">{owner?.name || <span className="text-gray-400">Not assigned</span>}</div>
          <div className="text-xs text-gray-500 mt-0.5">{owner ? `D&A point of contact · ${owner.email}` : 'Admin should assign one'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Requester</div>
          <div className="text-sm font-medium mt-1">{requester?.name || <span className="text-gray-400">Not assigned</span>}</div>
          <div className="text-xs text-gray-500 mt-0.5">{requester ? `Business stakeholder · ${requester.email}` : '—'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Open CRs</div>
          <div className="text-2xl font-medium mt-1">{crs.filter(c => c.status === 'Pending Approval' || c.status === 'Open').length}</div>
          <div className="text-xs text-gray-500 mt-0.5">{crs.length} total</div>
        </Card>
      </div>

      <Card className="p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium">Approvers for this dashboard ({approvers.length})</h3>
            <p className="text-xs text-gray-500 mt-1">These people approve <strong>BRD, Design, and UAT</strong> for this dashboard. Any of them can approve or reject; the decision is final.</p>
          </div>
          {currentRole?.isAdmin && <Btn onClick={() => setEditingApprovers(true)}>{approvers.length === 0 ? '+ Add approvers' : 'Manage'}</Btn>}
        </div>
        {approvers.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">⚠ No approvers assigned. BRD, Design, and UAT cannot be submitted until at least one approver is added.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {approvers.map(u => {
              const role = state.roles.find(r => r.id === u.roleId);
              const initials = u.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={u.id} className="flex items-center gap-3 border border-gray-200 rounded p-3">
                  <div className="w-10 h-10 rounded-full bg-[#1F2D5A] text-white flex items-center justify-center text-xs font-medium shrink-0">{initials}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-xs text-gray-500 truncate">{u.email}</div>
                    <div className="mt-1"><Badge tone="blue">{role?.name}</Badge></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5 mb-5">
        <h3 className="text-sm font-medium mb-4">Stage timeline</h3>
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {stages.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white ${
                  s.status === 'Approved' ? 'bg-emerald-600' :
                  s.status === 'Pending Approval' ? 'bg-amber-500' :
                  s.status === 'In Progress' ? 'bg-blue-500' :
                  s.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-300 text-gray-600'
                }`}>{s.stageOrder}</div>
                <div className="text-xs">
                  <div className="font-medium">{SHORT[s.stageKey]}</div>
                  <div className="text-gray-500 text-[10px]">{s.status}</div>
                </div>
              </div>
              {i < stages.length - 1 && <span className="text-gray-300 mx-1">→</span>}
            </React.Fragment>
          ))}
        </div>
        <table className="w-full text-xs mt-3">
          <thead><tr className="border-b border-gray-200 text-gray-500"><th className="text-left py-2 font-medium">Stage</th><th className="text-left py-2 font-medium">Owner</th><th className="text-left py-2 font-medium">Planned</th><th className="text-left py-2 font-medium">Actual</th><th className="text-left py-2 font-medium">Status</th><th className="text-left py-2 font-medium">Rebuilds</th></tr></thead>
          <tbody>
            {stages.map(s => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-2">{STAGE_LABEL[s.stageKey]}{NEEDS_APPROVAL[s.stageKey] && <span className="ml-1 text-amber-600" title="Requires approval">⚑</span>}</td>
                <td className="py-2 text-gray-600">{s.ownerId ? state.users.find(u => u.id === s.ownerId)?.name : '—'}</td>
                <td className="py-2 text-gray-600">{fmtDateShort(s.plannedDate)}</td>
                <td className="py-2 text-gray-600">{fmtDateShort(s.actualDate)}</td>
                <td className="py-2"><Badge tone={statusTone(s.status)}>{s.status}</Badge></td>
                <td className="py-2">{s.rebuildCount > 0 ? <Badge tone={s.escalated ? 'red' : 'amber'}>{s.rebuildCount}×</Badge> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-3">Approval history</h3>
          {approvals.length === 0 && <p className="text-xs text-gray-500">No approvals yet.</p>}
          <div className="space-y-2">
            {approvals.map(a => {
              const s = stages.find(x => x.id === a.stageId);
              const decider = a.decidedById ? state.users.find(u => u.id === a.decidedById) : null;
              return (
                <div key={a.id} className="text-xs border-l-2 pl-3 py-1" style={{ borderColor: a.status === 'Rejected' ? '#E24B4A' : a.status === 'Approved' ? '#1D9E75' : '#BA7517' }}>
                  <div><strong>{STAGE_LABEL[s?.stageKey]}</strong> v{a.version} · <Badge tone={a.status === 'Rejected' ? 'red' : a.status === 'Approved' ? 'green' : 'amber'}>{a.status}</Badge>{decider ? ` by ${decider.name}` : ''}{(a.attachments || []).length > 0 ? ` · 📎 ${a.attachments.length}` : ''}</div>
                  {a.comment && <div className="text-gray-600 mt-1">{a.comment}</div>}
                  <div className="text-gray-400 mt-1">{a.decidedAt ? fmtDateTime(a.decidedAt) : `submitted ${fmtDateTime(a.createdAt)}`}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Change requests</h3>
            <Btn onClick={() => go('crs-new', { dashboardId: dashboard.id })} className="text-xs">+ Raise CR</Btn>
          </div>
          {crs.length === 0 && <p className="text-xs text-gray-500">No CRs raised yet.</p>}
          <div className="space-y-2">
            {crs.map(c => {
              const t = state.crTypes.find(x => x.id === c.typeId);
              return (
                <div key={c.id} className="text-xs border-l-2 pl-3 py-1 border-purple-400">
                  <div><strong>{c.number}</strong> · {t?.name}</div>
                  <div className="text-gray-600 mt-1">{c.description}</div>
                  <div className="text-gray-400 mt-1"><Badge tone={c.status === 'Pending Approval' ? 'amber' : c.status === 'Approved' ? 'green' : c.status === 'Declined' ? 'red' : c.status === 'Open' ? 'amber' : 'gray'}>{c.status}</Badge> · routes to {STAGE_LABEL[c.routedTo]}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      {editingApprovers && <ApproversModal dashboard={dashboard} state={state} onClose={() => setEditingApprovers(false)} onSave={saveApprovers} />}
    </div>
  );
}

function ApproversModal({ dashboard, state, onClose, onSave }) {
  const [selectedIds, setSelectedIds] = useState(dashboard.approverIds || []);
  const [search, setSearch] = useState('');
  const eligible = state.users.filter(u => {
    if (u.status !== 'Active') return false;
    const role = state.roles.find(r => r.id === u.roleId);
    const p = role?.permissions || {};
    return p.approveBrd || p.approveDesign || p.signoffUat || role?.isAdmin;
  });
  const filtered = eligible.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id) => setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  return (
    <Modal open={true} onClose={onClose} title={`Manage approvers for ${dashboard.name}`} size="lg">
      <p className="text-xs text-gray-500 mb-3">Pick one or more people. Any of them can approve BRD, Design, or UAT for this dashboard. Anyone with a role permission to approve appears here.</p>
      <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="mb-3" />
      <div className="border border-gray-200 rounded max-h-72 overflow-y-auto">
        {filtered.length === 0 && <div className="p-4 text-xs text-gray-500 text-center">No matches. Try a different search or add new users via Admin → Users.</div>}
        {filtered.map(u => {
          const role = state.roles.find(r => r.id === u.roleId);
          const checked = selectedIds.includes(u.id);
          return (
            <label key={u.id} className={`flex items-center gap-3 p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} className="w-4 h-4" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              <Badge tone="blue">{role?.name}</Badge>
            </label>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-gray-500">{selectedIds.length} selected</div>
      <div className="flex justify-end gap-2 mt-4">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => onSave(selectedIds)}>Save approvers</Btn>
      </div>
    </Modal>
  );
}

function CrsLog({ ctx }) {
  const { state, currentUser, currentRole, go } = ctx;
  const visibleDashIds = new Set(state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d)).map(d => d.id));
  const visibleCrs = state.crs.filter(c => visibleDashIds.has(c.dashboardId));
  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div><h1 className="text-xl font-medium">Change requests</h1><p className="text-sm text-gray-500 mt-1">{visibleCrs.length} total · {visibleCrs.filter(c => c.status === 'Pending Approval' || c.status === 'Open').length} active · {visibleCrs.filter(c => c.status === 'Approved').length} approved · {visibleCrs.filter(c => c.status === 'Declined').length} declined</p></div>
        <Btn variant="primary" onClick={() => go('crs-new')}>+ Raise CR</Btn>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="text-left px-4 py-3 font-medium">#</th><th className="text-left px-4 py-3 font-medium">Dashboard</th><th className="text-left px-4 py-3 font-medium">Type</th><th className="text-left px-4 py-3 font-medium">Description</th><th className="text-left px-4 py-3 font-medium">Routes to</th><th className="text-left px-4 py-3 font-medium">Raised by</th><th className="text-left px-4 py-3 font-medium">Priority</th><th className="text-left px-4 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleCrs.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">No CRs raised yet. Click "Raise CR" to create one.</td></tr>}
            {visibleCrs.slice().reverse().map(c => {
              const d = state.dashboards.find(x => x.id === c.dashboardId);
              const t = state.crTypes.find(x => x.id === c.typeId);
              const u = state.users.find(x => x.id === c.raisedById);
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono text-xs">{c.number}</td>
                  <td className="px-4 py-3 text-xs">{d?.name}</td>
                  <td className="px-4 py-3"><Badge tone="purple">{t?.name}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{c.description}</td>
                  <td className="px-4 py-3"><Badge tone="gray">{STAGE_LABEL[c.routedTo]}</Badge></td>
                  <td className="px-4 py-3 text-xs">{u?.name}</td>
                  <td className="px-4 py-3"><Badge tone={c.priority === 'High' ? 'red' : c.priority === 'Medium' ? 'amber' : 'gray'}>{c.priority}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={c.status === 'Pending Approval' ? 'amber' : c.status === 'Approved' ? 'green' : c.status === 'Declined' ? 'red' : c.status === 'Open' ? 'amber' : 'gray'}>{c.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function NewCrPage({ ctx }) {
  const { state, currentUser, currentRole, update, audit, showToast, go, params } = ctx;
  const visibleDashboards = state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d));
  const [dashboardId, setDashboardId] = useState(params.dashboardId || visibleDashboards[0]?.id || '');
  const [typeId, setTypeId] = useState(state.crTypes[0]?.id || '');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [busy, setBusy] = useState(false);
  const selectedType = state.crTypes.find(t => t.id === typeId);

  const submit = async () => {
    if (!description.trim()) { showToast('Description required', 'error'); return; }
    const d = state.dashboards.find(x => x.id === dashboardId);
    if (!d) { showToast('Dashboard not found', 'error'); return; }
    const fullApprovers = [...new Set([d.requesterId, ...(d.approverIds || [])].filter(Boolean))];
    if (fullApprovers.length === 0) {
      showToast(`Cannot raise CR · ${d.name} has no requester or approvers. Admin must assign first.`, 'error');
      return;
    }
    setBusy(true);
    const num = `CR-${String(state.crs.length + 1).padStart(3, '0')}`;
    const now = nowIso();
    const cr = { id: genId(), number: num, dashboardId, typeId, description, raisedById: currentUser.id, priority, status: 'Pending Approval', routedTo: selectedType.routesTo, resolution: null, closedAt: null, createdAt: now };
    const approverStates = fullApprovers.map(id => ({ approverId: id, originalApproverId: id, status: 'Pending', comment: null, decidedAt: null, delegatedToId: null, delegatedFromId: null }));
    const approval = { id: genId(), stageId: null, crId: cr.id, approverIds: [...fullApprovers], approverStates, decidedById: null, status: 'Pending', comment: null, decidedAt: null, attachments: [], version: 1, createdAt: now };
    const names = fullApprovers.map(id => state.users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
    const requesterNote = d.requesterId ? ` (requester ${state.users.find(u => u.id === d.requesterId)?.name} included automatically)` : '';
    const logs = audit(`raised ${num} (${selectedType.name}) for ${d.name} · notified ${fullApprovers.length} approver${fullApprovers.length === 1 ? '' : 's'}${requesterNote}`, 'ChangeRequest', cr.id).auditLog;
    await update({ ...state, crs: [...state.crs, cr], approvals: [...state.approvals, approval], auditLog: logs });
    showToast(`${num} sent · ${fullApprovers.length} must approve: ${names}`);
    setBusy(false); go('crs');
  };

  return (
    <div>
      <button onClick={() => go('crs')} className="text-sm text-gray-500 hover:text-[#1F2D5A] mb-3 inline-block">← Back to CRs</button>
      <h1 className="text-xl font-medium mb-1">Raise a change request</h1>
      <p className="text-sm text-gray-500 mb-5">CRs auto-route to the relevant stage based on type.</p>
      <Card className="p-5 max-w-xl">
        <Label>Dashboard</Label>
        <Select value={dashboardId} onChange={e => setDashboardId(e.target.value)} className="mb-3">
          {visibleDashboards.map(d => <option key={d.id} value={d.id}>#{d.num} · {d.name}</option>)}
        </Select>
        <Label>CR type</Label>
        <Select value={typeId} onChange={e => setTypeId(e.target.value)} className="mb-1">
          {state.crTypes.map(t => <option key={t.id} value={t.id}>{t.name} (routes to {STAGE_LABEL[t.routesTo]})</option>)}
        </Select>
        {selectedType?.description && <p className="text-xs text-gray-500 mb-3">{selectedType.description}</p>}
        <Label>Description</Label>
        <TextArea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="What needs to change and why…" className="mb-3" />
        <Label>Priority</Label>
        <Select value={priority} onChange={e => setPriority(e.target.value)} className="mb-4">
          <option>Low</option><option>Medium</option><option>High</option>
        </Select>
        <div className="flex justify-end gap-2">
          <Btn onClick={() => go('crs')}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit CR'}</Btn>
        </div>
      </Card>
    </div>
  );
}

function Scorecard({ ctx }) {
  const { state, currentUser, currentRole } = ctx;
  const visibleDashboards = state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d));
  const visibleDashIds = new Set(visibleDashboards.map(d => d.id));
  const visibleStages = state.stages.filter(s => visibleDashIds.has(s.dashboardId));
  const total = visibleDashboards.length;
  const delivered = visibleDashboards.filter(d => state.stages.filter(s => s.dashboardId === d.id).every(s => s.actualDate)).length;
  const portfolioPct = total === 0 ? 0 : Math.round((delivered / total) * 1000) / 10;
  const yasirS = visibleStages.filter(s => s.stageKey === 'DATA_MODEL' || s.stageKey === 'PIPELINE');
  const yasirDone = yasirS.filter(s => s.actualDate).length;
  const yasirPct = yasirS.length === 0 ? 0 : Math.round((yasirDone / yasirS.length) * 1000) / 10;
  const ahmadS = visibleStages.filter(s => s.stageKey === 'DESIGN_APPROVAL' || s.stageKey === 'VISUAL');
  const ahmadDone = ahmadS.filter(s => s.actualDate).length;
  const ahmadPct = ahmadS.length === 0 ? 0 : Math.round((ahmadDone / ahmadS.length) * 1000) / 10;
  const rag = (pct, target) => pct >= target ? 'green' : pct >= target * 0.8 ? 'amber' : 'red';
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">Annual delivery scorecard 2026</h1>
      <p className="text-sm text-gray-500 mb-5">Target: 100% of {total} dashboards delivered by 31-Dec-2026</p>
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-5 rounded">
        <div className="text-sm text-amber-900 font-medium">Portfolio status</div>
        <div className="text-xs text-amber-800 mt-1">Yasir: {yasirPct}% · Ahmad: {ahmadPct}% · Total: {portfolioPct}% delivered ({delivered}/{total})</div>
      </div>
      <div className="grid grid-cols-3 gap-5 mb-5">
        <Card className="p-5"><div className="text-xs text-gray-500 uppercase tracking-wide">Yasir overall</div><div className="text-3xl font-medium mt-2">{yasirPct}%</div><div className="text-xs text-gray-500 mt-1">{yasirDone} of {yasirS.length} DE stages</div><div className="mt-3"><Badge tone={rag(yasirPct, 60)}>{rag(yasirPct, 60).toUpperCase()}</Badge></div></Card>
        <Card className="p-5"><div className="text-xs text-gray-500 uppercase tracking-wide">Ahmad overall</div><div className="text-3xl font-medium mt-2">{ahmadPct}%</div><div className="text-xs text-gray-500 mt-1">{ahmadDone} of {ahmadS.length} BI stages</div><div className="mt-3"><Badge tone={rag(ahmadPct, 60)}>{rag(ahmadPct, 60).toUpperCase()}</Badge></div></Card>
        <Card className="p-5"><div className="text-xs text-gray-500 uppercase tracking-wide">Portfolio</div><div className="text-3xl font-medium mt-2">{portfolioPct}%</div><div className="text-xs text-gray-500 mt-1">{delivered} of {total} fully delivered</div><div className="mt-3"><Badge tone={rag(portfolioPct, 75)}>{rag(portfolioPct, 75).toUpperCase()}</Badge></div></Card>
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-medium mb-4">By tier</h3>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="text-left py-2 font-medium">Tier</th><th className="text-left py-2 font-medium">Dashboards</th><th className="text-left py-2 font-medium">Delivered</th><th className="text-left py-2 font-medium">%</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {['P1', 'P2', 'P3'].map(t => {
              const inTier = visibleDashboards.filter(d => d.tier === t);
              const dlv = inTier.filter(d => state.stages.filter(s => s.dashboardId === d.id).every(s => s.actualDate)).length;
              const pct = inTier.length ? Math.round((dlv / inTier.length) * 100) : 0;
              return <tr key={t}><td className="py-2"><Badge tone={t === 'P1' ? 'red' : t === 'P2' ? 'amber' : 'gray'}>{t}</Badge></td><td className="py-2">{inTier.length}</td><td className="py-2">{dlv}</td><td className="py-2">{pct}%</td></tr>;
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function GanttView({ ctx }) {
  const { state, currentUser, currentRole } = ctx;
  const visibleDashboards = state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d));
  const colorMap = { Approved: '#1D9E75', 'Pending Approval': '#BA7517', 'In Progress': '#378ADD', Rejected: '#E24B4A' };
  const defaultColor = '#B4B2A9';
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">Gantt overview</h1>
      <p className="text-sm text-gray-500 mb-5">Stage progress across {visibleDashboards.length} dashboard{visibleDashboards.length === 1 ? '' : 's'} in your scope.</p>
      <Card className="p-5 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-gray-200 text-gray-500"><tr><th className="text-left py-2 font-medium w-64">Dashboard</th><th className="text-left py-2 font-medium">Progress · BRD → Production</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {visibleDashboards.map(d => {
              const stages = state.stages.filter(s => s.dashboardId === d.id).sort((a, b) => a.stageOrder - b.stageOrder);
              return (
                <tr key={d.id}>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-gray-500 mt-0.5 flex items-center gap-2">#{d.num} · {d.domain} · <Badge tone={d.tier === 'P1' ? 'red' : d.tier === 'P2' ? 'amber' : 'gray'}>{d.tier}</Badge></div>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-0.5">
                      {stages.map(s => (
                        <div key={s.id} className="flex-1 h-8 rounded-sm flex items-center justify-center text-[10px] font-medium text-white" style={{ background: colorMap[s.status] || defaultColor }} title={`${STAGE_LABEL[s.stageKey]}: ${s.status}`}>{SHORT[s.stageKey]}</div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs flex-wrap">
          <span className="text-gray-500">Legend:</span>
          {Object.entries(colorMap).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: v }}></span>{k}</span>)}
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: defaultColor }}></span>Not Started</span>
        </div>
      </Card>
    </div>
  );
}

function ReportsPage({ ctx }) {
  const { state, currentUser, currentRole } = ctx;
  const visibleDashboards = state.dashboards.filter(d => canViewDashboard(currentUser, currentRole, d));
  const visibleDashIds = new Set(visibleDashboards.map(d => d.id));
  const visibleStages = state.stages.filter(s => visibleDashIds.has(s.dashboardId));
  const visibleCrs = state.crs.filter(c => visibleDashIds.has(c.dashboardId));
  const dashCount = visibleDashboards.length, userCount = state.users.length, openCrs = visibleCrs.filter(c => c.status === 'Pending Approval' || c.status === 'Open').length;
  const totalStages = visibleStages.length, doneStages = visibleStages.filter(s => s.actualDate).length;
  const approvedCount = state.approvals.filter(a => a.status === 'Approved').length;
  const rejectedCount = state.approvals.filter(a => a.status === 'Rejected').length;
  const pct = totalStages === 0 ? 0 : Math.round((doneStages / totalStages) * 1000) / 10;
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">Reports</h1>
      <p className="text-sm text-gray-500 mb-5">Portfolio-level numbers.</p>
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">Portfolio summary</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr><td className="py-2 text-gray-600">Total dashboards</td><td className="py-2 text-right font-medium">{dashCount}</td></tr>
              <tr><td className="py-2 text-gray-600">Active users</td><td className="py-2 text-right font-medium">{userCount}</td></tr>
              <tr><td className="py-2 text-gray-600">Total stages</td><td className="py-2 text-right font-medium">{totalStages}</td></tr>
              <tr><td className="py-2 text-gray-600">Stages completed</td><td className="py-2 text-right font-medium">{doneStages}</td></tr>
              <tr><td className="py-2 text-gray-600">Portfolio % delivered</td><td className="py-2 text-right font-medium">{pct}%</td></tr>
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-medium mb-4">Approval activity</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr><td className="py-2 text-gray-600">Approved (lifetime)</td><td className="py-2 text-right font-medium text-emerald-700">{approvedCount}</td></tr>
              <tr><td className="py-2 text-gray-600">Rejected (lifetime)</td><td className="py-2 text-right font-medium text-red-700">{rejectedCount}</td></tr>
              <tr><td className="py-2 text-gray-600">Approval rate</td><td className="py-2 text-right font-medium">{approvedCount + rejectedCount === 0 ? '—' : Math.round((approvedCount / (approvedCount + rejectedCount)) * 100) + '%'}</td></tr>
              <tr><td className="py-2 text-gray-600">Open change requests</td><td className="py-2 text-right font-medium">{openCrs}</td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function UsersAdmin({ ctx }) {
  const { state, update, audit, showToast, currentUser } = ctx;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(state.roles[0]?.id || '');
  const [scopeDomain, setScopeDomain] = useState('All');
  const [err, setErr] = useState(null);
  const [generatedLink, setGeneratedLink] = useState(null);

  const submit = async () => {
    setErr(null);
    if (!name || !email) { setErr('Name and email required'); return; }
    if (state.users.find(u => u.email.toLowerCase() === email.toLowerCase())) { setErr('Email already in use'); return; }
    const inviteToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const u = { id: genId(), email: email.toLowerCase(), name, roleId, scope: scopeDomain === 'All' ? null : { domains: [scopeDomain] }, status: 'Invited', inviteToken, createdAt: nowIso() };
    const role = state.roles.find(r => r.id === roleId);
    const logs = audit(`invited ${u.email} as ${role.name}`, 'User', u.id).auditLog;
    await update({ ...state, users: [...state.users, u], auditLog: logs });
    setGeneratedLink(`accept-invite?token=${inviteToken}`);
    showToast(`Invite sent to ${u.email}`);
    setName(''); setEmail('');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-xl font-medium">Users</h1><p className="text-sm text-gray-500 mt-1">{state.users.length} total · {state.users.filter(u => u.status === 'Invited').length} pending invite</p></div>
        <Btn variant="primary" onClick={() => { setOpen(true); setGeneratedLink(null); }}>+ Add user</Btn>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="text-left px-4 py-3 font-medium">Name</th><th className="text-left px-4 py-3 font-medium">Email</th><th className="text-left px-4 py-3 font-medium">Role</th><th className="text-left px-4 py-3 font-medium">Scope</th><th className="text-left px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {state.users.map(u => {
              const role = state.roles.find(r => r.id === u.roleId);
              const scope = u.scope?.domains ? u.scope.domains.join(', ') : 'All';
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><Badge tone="blue">{role?.name}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{scope}</td>
                  <td className="px-4 py-3"><Badge tone={u.status === 'Active' ? 'green' : u.status === 'Invited' ? 'amber' : 'red'}>{u.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Add user · send invite">
        {generatedLink ? (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-emerald-800 mb-3">✓ Invite created (in a real install this would email the link). In the demo, copy and click this link or share it:</div>
            <div className="font-mono text-xs bg-gray-100 p-2 rounded break-all">{generatedLink}</div>
            <p className="text-xs text-gray-500 mt-3">Note: this demo doesn't simulate the magic-link flow visually — the new user will appear in the list above with status "Invited" until they activate.</p>
            <div className="flex justify-end mt-4"><Btn onClick={() => { setOpen(false); setGeneratedLink(null); }}>Close</Btn></div>
          </div>
        ) : (
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mb-3" placeholder="e.g. Mohammed Al-Saud" />
            <Label>Work email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mb-3" placeholder="mohammed@remat.sa" />
            <Label>Role</Label>
            <Select value={roleId} onChange={e => setRoleId(e.target.value)} className="mb-3">
              {state.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <Label>Scope · which category?</Label>
            <Select value={scopeDomain} onChange={e => setScopeDomain(e.target.value)} className="mb-4">
              <option value="All">All</option>
              {[...new Set(state.dashboards.map(d => d.domain).filter(Boolean))].sort().map(d => <option key={d}>{d}</option>)}
            </Select>
            {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{err}</div>}
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setOpen(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={submit}>Send invite</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AdminDashboards({ ctx }) {
  const { state, go, params } = ctx;
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const activeCategory = params.category || null;

  if (!activeCategory) {
    const byCategory = {};
    state.dashboards.forEach(d => {
      const cat = d.domain || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = { name: cat, count: 0, p1: 0, p2: 0, p3: 0, withOwner: 0, withRequester: 0, withApprovers: 0 };
      byCategory[cat].count++;
      const t = (d.tier || '').toLowerCase();
      if (t === 'p1') byCategory[cat].p1++;
      else if (t === 'p2') byCategory[cat].p2++;
      else if (t === 'p3') byCategory[cat].p3++;
      if (d.ownerId) byCategory[cat].withOwner++;
      if (d.requesterId) byCategory[cat].withRequester++;
      if ((d.approverIds || []).length > 0) byCategory[cat].withApprovers++;
    });
    const categories = Object.values(byCategory).sort((a, b) => b.count - a.count);
    const totalGaps = state.dashboards.filter(d => !d.ownerId || !d.requesterId || (d.approverIds || []).length === 0).length;
    return (
      <div>
        <div className="flex justify-between items-start mb-5">
          <div>
            <h1 className="text-xl font-medium">Manage dashboards</h1>
            <p className="text-sm text-gray-500 mt-1">{state.dashboards.length} dashboard{state.dashboards.length === 1 ? '' : 's'} in {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}{totalGaps > 0 ? ` · ${totalGaps} need configuration` : ''}</p>
          </div>
          <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add dashboard</Btn>
        </div>
        {categories.length === 0 ? (
          <Card className="p-12 text-center text-sm text-gray-500">No dashboards yet. Click "+ Add dashboard" above to create the first one.</Card>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {categories.map(c => {
              const needsOwner = c.count - c.withOwner;
              const needsRequester = c.count - c.withRequester;
              const needsApprovers = c.count - c.withApprovers;
              const hasGaps = needsOwner > 0 || needsApprovers > 0;
              return (
                <button key={c.name} onClick={() => go('admin-dashboards', { category: c.name })} className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-[#1F2D5A] hover:shadow-md transition group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Category</div>
                      <div className="text-base font-medium mt-1 group-hover:text-[#1F2D5A]">{c.name}</div>
                    </div>
                    <div className="text-2xl font-medium text-[#1F2D5A]">{c.count}</div>
                  </div>
                  <div className="flex gap-1 mb-3 flex-wrap">
                    {c.p1 > 0 && <Badge tone="red">{c.p1} P1</Badge>}
                    {c.p2 > 0 && <Badge tone="amber">{c.p2} P2</Badge>}
                    {c.p3 > 0 && <Badge tone="gray">{c.p3} P3</Badge>}
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">With owner</span><span className={c.withOwner === c.count ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>{c.withOwner}/{c.count}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">With requester</span><span className={c.withRequester === c.count ? 'font-medium text-emerald-700' : 'font-medium text-gray-700'}>{c.withRequester}/{c.count}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">With approvers</span><span className={c.withApprovers === c.count ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>{c.withApprovers}/{c.count}</span></div>
                  </div>
                  {hasGaps && <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-amber-700">⚠ {Math.max(needsOwner, needsApprovers)} dashboard{Math.max(needsOwner, needsApprovers) === 1 ? '' : 's'} need configuration</div>}
                </button>
              );
            })}
          </div>
        )}
        {showAdd && <AddDashboardModal ctx={ctx} onClose={() => setShowAdd(false)} />}
      </div>
    );
  }

  const dashboardsInCategory = state.dashboards.filter(d => (d.domain || 'Uncategorized') === activeCategory).sort((a, b) => (a.num || 0) - (b.num || 0));
  const cfgGaps = dashboardsInCategory.filter(d => !d.ownerId || !d.requesterId || (d.approverIds || []).length === 0).length;
  return (
    <div>
      <button onClick={() => go('admin-dashboards')} className="text-sm text-gray-500 hover:text-[#1F2D5A] mb-3 inline-block">← All categories</button>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-medium">Manage dashboards · {activeCategory}</h1>
          <p className="text-sm text-gray-500 mt-1">{dashboardsInCategory.length} dashboard{dashboardsInCategory.length === 1 ? '' : 's'} in {activeCategory}{cfgGaps > 0 ? ` · ${cfgGaps} need configuration` : ''}</p>
        </div>
        <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add dashboard</Btn>
      </div>
      {dashboardsInCategory.length === 0 ? (
        <Card className="p-12 text-center text-sm text-gray-500">No dashboards in {activeCategory}. Click "+ Add dashboard" to create the first one in this category.</Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="text-left px-4 py-3 font-medium">#</th><th className="text-left px-4 py-3 font-medium">Name</th><th className="text-left px-4 py-3 font-medium">Tier</th><th className="text-left px-4 py-3 font-medium">Owner</th><th className="text-left px-4 py-3 font-medium">Requester</th><th className="text-left px-4 py-3 font-medium">Approvers</th><th></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {dashboardsInCategory.map(d => {
                const approvers = (d.approverIds || []).map(id => state.users.find(u => u.id === id)).filter(Boolean);
                const owner = d.ownerId ? state.users.find(u => u.id === d.ownerId) : null;
                const requester = d.requesterId ? state.users.find(u => u.id === d.requesterId) : null;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-gray-500">{d.num}</td>
                    <td className="px-4 py-3 font-medium"><button onClick={() => go('dashboard-detail', { dashboardId: d.id })} className="text-left hover:text-[#1F2D5A] hover:underline">{d.name}</button></td>
                    <td className="px-4 py-3"><Badge tone={d.tier === 'P1' ? 'red' : d.tier === 'P2' ? 'amber' : 'gray'}>{d.tier}</Badge></td>
                    <td className="px-4 py-3 text-xs">{owner?.name || <span className="text-amber-700">⚠ —</span>}</td>
                    <td className="px-4 py-3 text-xs">{requester?.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-xs">
                      {approvers.length === 0 ? <span className="text-amber-700">⚠ none</span> : (
                        <div className="flex gap-1 flex-wrap">{approvers.map(u => <Badge key={u.id} tone="blue">{u.name}</Badge>)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Btn variant="primary" onClick={() => setEditing(d)} className="text-xs">Edit</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {editing && <AddDashboardModal ctx={ctx} editing={editing} onClose={() => setEditing(null)} />}
      {showAdd && <AddDashboardModal ctx={ctx} prefillCategory={activeCategory} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function WorkflowAdmin({ ctx }) {
  const { state } = ctx;
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">Workflow & lookups</h1>
      <p className="text-sm text-gray-500 mb-5">Manage the role and CR type taxonomies that drive routing.</p>
      <LookupSection title="Roles" subtitle="System roles cannot be removed. You can add custom roles for specialized workflows." kind="role" ctx={ctx} items={state.roles} />
      <LookupSection title="Change Request types" subtitle="Each CR type routes back to a specific stage when raised." kind="crType" ctx={ctx} items={state.crTypes} />
    </div>
  );
}

function LookupSection({ title, subtitle, kind, ctx, items }) {
  const { state, update, audit, showToast } = ctx;
  const [open, setOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [routesTo, setRoutesTo] = useState('BRD');
  const [permissions, setPermissions] = useState({});
  const [err, setErr] = useState(null);
  const permOptions = ['approveBrd', 'approveDesign', 'signoffUat', 'addUsers', 'manageLookups', 'viewAll', 'raiseCr', 'overrideApprovals'];

  const submit = async () => {
    setErr(null);
    if (!keyName || !displayName) { setErr('Key and name required'); return; }
    if (kind === 'role') {
      if (state.roles.find(r => r.key === keyName)) { setErr('Key already exists'); return; }
      const r = { id: genId(), key: keyName, name: displayName, description, permissions, isAdmin: false, isSystem: false };
      const logs = audit(`created role ${displayName}`, 'Role', r.id).auditLog;
      await update({ ...state, roles: [...state.roles, r], auditLog: logs });
    } else {
      if (state.crTypes.find(t => t.key === keyName)) { setErr('Key already exists'); return; }
      const t = { id: genId(), key: keyName, name: displayName, description, routesTo, isSystem: false };
      const logs = audit(`created CR type ${displayName}`, 'CrType', t.id).auditLog;
      await update({ ...state, crTypes: [...state.crTypes, t], auditLog: logs });
    }
    showToast(`Added ${displayName}`);
    setOpen(false); setKeyName(''); setDisplayName(''); setDescription(''); setPermissions({});
  };

  return (
    <Card className="p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-sm font-medium">{title}</h2><p className="text-xs text-gray-500 mt-0.5">{subtitle}</p></div>
        <Btn variant="primary" onClick={() => setOpen(true)}>+ Add {kind === 'role' ? 'role' : 'CR type'}</Btn>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="text-left py-2 font-medium">Key</th><th className="text-left py-2 font-medium">Name</th><th className="text-left py-2 font-medium">Description</th>{kind === 'role' ? <th className="text-left py-2 font-medium">Permissions</th> : <th className="text-left py-2 font-medium">Routes to</th>}<th className="text-left py-2 font-medium">System</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(r => (
            <tr key={r.id}>
              <td className="py-2 font-mono text-xs">{r.key}</td>
              <td className="py-2 font-medium">{r.name}</td>
              <td className="py-2 text-xs text-gray-600">{r.description || '—'}</td>
              {kind === 'role' ? (
                <td className="py-2 text-xs"><div className="flex gap-1 flex-wrap max-w-md">{Object.entries(r.permissions || {}).filter(([_, v]) => v).map(([k]) => <Badge key={k} tone="gray">{k}</Badge>)}</div></td>
              ) : (
                <td className="py-2"><Badge tone="purple">{STAGE_LABEL[r.routesTo]}</Badge></td>
              )}
              <td className="py-2">{r.isSystem ? <Badge tone="blue">system</Badge> : <Badge tone="green">custom</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={open} onClose={() => setOpen(false)} title={`Add ${kind === 'role' ? 'role' : 'CR type'}`}>
        <Label>Key (unique, uppercase)</Label>
        <Input value={keyName} onChange={e => setKeyName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} placeholder={kind === 'role' ? 'AUDIT_REVIEWER' : 'DATA_QUALITY_ISSUE'} className="mb-3" />
        <Label>Display name</Label>
        <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={kind === 'role' ? 'Audit Reviewer' : 'Data quality issue'} className="mb-3" />
        <Label>Description</Label>
        <TextArea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mb-3" />
        {kind === 'crType' && <>
          <Label>Routes back to which stage?</Label>
          <Select value={routesTo} onChange={e => setRoutesTo(e.target.value)} className="mb-3">
            {STAGE_KEYS.map(k => <option key={k} value={k}>{STAGE_LABEL[k]}</option>)}
          </Select>
        </>}
        {kind === 'role' && <>
          <Label>Permissions</Label>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            {permOptions.map(p => (
              <label key={p} className="flex items-center gap-2"><input type="checkbox" checked={!!permissions[p]} onChange={e => setPermissions({ ...permissions, [p]: e.target.checked })} />{p}</label>
            ))}
          </div>
        </>}
        {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{err}</div>}
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={submit}>Add</Btn>
        </div>
      </Modal>
    </Card>
  );
}

function AuditPage({ ctx }) {
  const { state } = ctx;
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">Audit log</h1>
      <p className="text-sm text-gray-500 mb-5">{(state.auditLog || []).length} system events recorded.</p>
      <Card>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="text-left px-4 py-3 font-medium">When</th><th className="text-left px-4 py-3 font-medium">User</th><th className="text-left px-4 py-3 font-medium">Action</th><th className="text-left px-4 py-3 font-medium">Entity</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {(state.auditLog || []).length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">No audit events yet.</td></tr>}
            {(state.auditLog || []).map(l => {
              const u = state.users.find(x => x.id === l.userId);
              return (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">{u?.name || <span className="text-gray-400">System</span>}</td>
                  <td className="px-4 py-3 text-sm">{l.action}</td>
                  <td className="px-4 py-3"><Badge tone="gray">{l.entity}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SettingsPage({ ctx }) {
  const { state, update, audit, showToast, currentUser } = ctx;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const stageCount = (state.stages || []).length;
  const approvalCount = (state.approvals || []).length;
  const crCount = (state.crs || []).length;
  const resetTimelines = async () => {
    setBusy(true);
    const resetStages = (state.stages || []).map(s => ({
      ...s,
      status: 'Not Started',
      actualDate: null,
      rebuildCount: 0,
      escalated: false,
      submittedAt: null,
      approvedAt: null
    }));
    const logs = audit(`RESET all stage timelines · cleared ${stageCount} stages, ${approvalCount} approvals, ${crCount} CRs · all stages set to Not Started`, 'System', null).auditLog;
    await update({ ...state, stages: resetStages, approvals: [], crs: [], auditLog: logs });
    showToast(`Reset complete · ${stageCount} stages reset · ${approvalCount} approvals cleared · ${crCount} CRs cleared`);
    setBusy(false); setConfirming(false);
  };
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-5">System configuration.</p>
      <Card className="p-5 mb-5">
        <h3 className="text-sm font-medium mb-3">Active configuration (demo)</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 text-gray-600 text-xs">Database</td><td className="py-2 text-right text-xs font-mono">window.storage (browser)</td></tr>
            <tr><td className="py-2 text-gray-600 text-xs">Auth</td><td className="py-2 text-right text-xs font-mono">Demo: switch user via top bar</td></tr>
            <tr><td className="py-2 text-gray-600 text-xs">Email</td><td className="py-2 text-right text-xs font-mono">In-app toasts (not sent)</td></tr>
            <tr><td className="py-2 text-gray-600 text-xs">Rebuild escalation threshold</td><td className="py-2 text-right text-xs font-mono">{REBUILD_THRESHOLD} rejections</td></tr>
          </tbody>
        </table>
      </Card>
      <Card className="p-5 mb-5 border-amber-300">
        <h3 className="text-sm font-medium mb-2">Reset stage timelines</h3>
        <p className="text-xs text-gray-600 mb-3">Resets every dashboard's stage workflow back to day-zero state. <strong>All 7 stages on every dashboard flip to Not Started.</strong> Clears all actual dates, all rebuild counters, all approvals, and all CRs. BRD remains actionable (it has no predecessor to be blocked by).</p>
        <p className="text-xs text-gray-500 mb-4"><strong>Preserved:</strong> dashboards (name, category, tier, owner, requester, approvers), users, roles, planned dates, audit log.</p>
        <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4 text-xs">
          <div className="font-medium text-gray-700 mb-1">Current state:</div>
          <div className="text-gray-600">{stageCount} stages · {approvalCount} approvals · {crCount} CRs</div>
        </div>
        {!confirming ? (
          <Btn onClick={() => setConfirming(true)} className="bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100">⚠ Reset all stage timelines</Btn>
        ) : (
          <div className="bg-amber-50 border border-amber-300 rounded p-3">
            <p className="text-sm text-amber-900 mb-3"><strong>Are you sure?</strong> This will wipe all workflow progress on all 15 dashboards. Approvals and CRs will be deleted. This cannot be undone except by recreating the data.</p>
            <div className="flex gap-2">
              <Btn variant="danger" onClick={resetTimelines} disabled={busy}>{busy ? 'Resetting…' : 'Yes · reset all timelines'}</Btn>
              <Btn onClick={() => setConfirming(false)} disabled={busy}>Cancel</Btn>
            </div>
          </div>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-medium mb-2">Production deployment</h3>
        <p className="text-xs text-gray-500 mb-3">This is the live demo. The on-prem build (in the previous zip delivery) runs as Next.js + libsql/SQLite with real SMTP email and JWT sessions.</p>
      </Card>
    </div>
  );
}

function AcceptInvitePage({ ctx, setCurrentUserId }) {
  return <div className="text-sm text-gray-500">Accept invite flow (demo): in the live app, the link emailed to the new user opens this page and prompts for password setup. In this artifact, the user appears in the list and you can switch to them via the top-bar dropdown.</div>;
}
