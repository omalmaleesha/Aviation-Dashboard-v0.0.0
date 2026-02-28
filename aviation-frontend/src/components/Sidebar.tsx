import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map,
  TableProperties,
  ChevronLeft,
  ChevronRight,
  Radar,
  Radio,
  Settings,
  BarChart3,
  ShieldAlert,
  Timer,
  DollarSign,
} from 'lucide-react';

export type { SidebarView } from '../store/slices/uiSlice';
import type { SidebarView } from '../store/slices/uiSlice';

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

interface NavItem {
  id: SidebarView;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'map',
    label: 'Live Map',
    icon: <Map className="w-5 h-5" />,
    description: 'Real-time flight tracking',
  },
  {
    id: 'flights-table',
    label: 'Flights & Details',
    icon: <TableProperties className="w-5 h-5" />,
    description: 'Tabular flight data view',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: <ShieldAlert className="w-5 h-5" />,
    description: 'Geofence & arrival alerts',
  },
  {
    id: 'turnarounds',
    label: 'Turnarounds',
    icon: <Timer className="w-5 h-5" />,
    description: 'Operational turnaround mgmt',
  },
  {
    id: 'fuel-analytics',
    label: 'Fuel & Cost',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'Fuel burn & cost analytics',
  },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 220 : 64 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex-shrink-0 flex flex-col h-full bg-slate-950 border-r border-gray-800/60 relative z-30"
    >
      {/* Top — Radar Icon */}
      <div className="flex items-center justify-center py-4 border-b border-gray-800/40">
        <motion.div
          animate={{ rotate: isExpanded ? 0 : 0 }}
          className="p-2 bg-aviation-blue/10 rounded-lg border border-aviation-blue/20"
        >
          <Radar className="w-5 h-5 text-aviation-blue" />
        </motion.div>
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="ml-3 text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap overflow-hidden"
            >
              Panels
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={!isExpanded ? item.label : undefined}
              className={`
                w-full flex items-center gap-3 rounded-lg transition-all duration-200 group relative
                ${isExpanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center'}
                ${
                  isActive
                    ? 'bg-aviation-blue/15 text-aviation-blue border border-aviation-blue/25'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-slate-800/40 border border-transparent'
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-aviation-blue rounded-r-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-aviation-blue' : 'group-hover:text-gray-300'}`}>
                {item.icon}
              </span>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    <div className={`text-xs font-semibold ${isActive ? 'text-aviation-blue' : 'text-gray-300'}`}>
                      {item.label}
                    </div>
                    <div className="text-[9px] text-gray-600 font-mono">{item.description}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tooltip when collapsed */}
              {!isExpanded && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 border border-gray-700/50 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                  <div className="text-[10px] font-semibold text-white">{item.label}</div>
                  <div className="text-[9px] text-gray-500 font-mono">{item.description}</div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-2 py-3 border-t border-gray-800/40 space-y-1">
        {/* Decorative items (non-functional) */}
        {[
          { icon: <BarChart3 className="w-4 h-4" />, label: 'Analytics' },
          { icon: <Radio className="w-4 h-4" />, label: 'Comms' },
          { icon: <Settings className="w-4 h-4" />, label: 'Settings' },
        ].map((item) => (
          <div
            key={item.label}
            title={!isExpanded ? item.label : undefined}
            className={`
              flex items-center gap-3 rounded-lg text-gray-600 cursor-default
              ${isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center'}
            `}
          >
            <span className="flex-shrink-0 opacity-40">{item.icon}</span>
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-[10px] font-mono text-gray-600 uppercase tracking-wider overflow-hidden whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Collapse/Expand Toggle */}
      <button
        onClick={() => setIsExpanded((e) => !e)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-slate-800 border border-gray-700/50 rounded-full text-gray-400 hover:text-white hover:bg-slate-700 transition-colors z-40 shadow-lg"
      >
        {isExpanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
    </motion.aside>
  );
}
