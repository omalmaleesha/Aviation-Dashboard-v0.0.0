import { useState, useEffect } from 'react';

export function UTCClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const utcString = time.toUTCString().split(' ').slice(-2).join(' ');
  const hours = String(time.getUTCHours()).padStart(2, '0');
  const minutes = String(time.getUTCMinutes()).padStart(2, '0');
  const seconds = String(time.getUTCSeconds()).padStart(2, '0');

  return (
    <div className="text-right font-mono">
      <div className="text-xs text-gray-400 uppercase tracking-widest">UTC TIME</div>
      <div className="text-2xl font-bold text-aviation-blue">{hours}:{minutes}:{seconds}</div>
      <div className="text-xs text-gray-500">{utcString}</div>
    </div>
  );
}
