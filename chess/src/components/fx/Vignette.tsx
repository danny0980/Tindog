/**
 * Cinematic vignette over the play area. Its strength follows the tension
 * of the moment (0 = calm, 1 = danger) and tints red when you are in danger.
 */
export function Vignette({ tension, danger }: { tension: number; danger: boolean }) {
  const strength = 0.18 + Math.min(1, Math.max(0, tension)) * 0.4
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 transition-[background] duration-700"
      aria-hidden="true"
      data-vignette={strength.toFixed(2)}
      style={{
        background: `radial-gradient(ellipse at 50% 45%, transparent 52%, ${danger ? `rgba(90,0,0,${strength})` : `rgba(0,0,0,${strength})`} 100%)`,
      }}
    />
  )
}
