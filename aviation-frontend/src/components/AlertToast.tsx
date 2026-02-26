import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Plane, MapPin } from 'lucide-react';
import type { AlertData } from '../types/flight';

const SEVERITY_STYLES: Record<string, { bar: string; bg: string; border: string; icon: string; glow: string }> = {
  CRITICAL: {
    bar: 'bg-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/40',
    icon: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  WARNING: {
    bar: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    icon: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  INFO: {
    bar: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    icon: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
};

interface AlertToastProps {
  alert: AlertData | null;
  onDismiss: () => void;
  /** Auto-dismiss after N ms (0 = no auto-dismiss). Default 8000 */
  autoDismissMs?: number;
}

export function AlertToast({ alert, onDismiss, autoDismissMs = 8000 }: AlertToastProps) {
  // Auto-dismiss timer
  useEffect(() => {
    if (!alert || autoDismissMs <= 0) return;
    const id = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(id);
  }, [alert, onDismiss, autoDismissMs]);

  const style = alert ? (SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.INFO) : SEVERITY_STYLES.INFO;

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`
            fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
            w-[600px] max-w-[90vw]
            rounded-xl overflow-hidden
            border ${style.border}
            ${style.bg} backdrop-blur-xl
            shadow-2xl ${style.glow}
          `}
        >
          {/* Animated severity bar at the top */}
          <motion.div
            className={`h-1 ${style.bar}`}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: autoDismissMs / 1000, ease: 'linear' }}
            style={{ transformOrigin: 'left' }}
          />

          <div className="px-5 py-4">
            <div className="flex items-start gap-4">
              {/* Pulsing icon */}
              <div className="flex-shrink-0 mt-0.5">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={`p-2 rounded-lg ${style.bg} border ${style.border}`}
                >
                  <AlertTriangle className={`w-5 h-5 ${style.icon}`} />
                </motion.div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Top row: severity + flight ID */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${style.icon}`}>
                    {alert.severity}
                  </span>
                  <span className="text-gray-600">•</span>
                  <div className="flex items-center gap-1">
                    <Plane className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-mono font-bold text-white">{alert.flightId}</span>
                  </div>
                </div>

                {/* Message */}
                <p className="text-sm text-gray-200 font-medium leading-snug mb-2">
                  {alert.message}
                </p>

                {/* Details row */}
                <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{alert.distance_km.toFixed(1)} km</span>
                  </div>
                  <span>ALT {alert.altitude.toLocaleString()} ft</span>
                  <span>{new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })} UTC</span>
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={onDismiss}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <X className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
