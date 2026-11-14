'use client';

/**
 * Animated audio waveform. Pure CSS (no canvas, no rAF loop) so it costs almost
 * nothing on a low-end Android device, and it respects prefers-reduced-motion.
 */
export default function Waveform({ active, bars = 5 }: { active: boolean; bars?: number }) {
  return (
    <span className="inline-flex items-end gap-[3px] h-4" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-all ${
            active ? 'bg-current js-wave-bar' : 'bg-current opacity-30'
          }`}
          style={{
            height: active ? undefined : '6px',
            animationDelay: `${i * 120}ms`,
            animationDuration: `${700 + i * 90}ms`,
          }}
        />
      ))}
    </span>
  );
}
