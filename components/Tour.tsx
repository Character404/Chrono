/** A numbered step in the 60-second judge tour. */
export function TourStep({ step, total, children }: { step: number; total: number; children: React.ReactNode }) {
  return (
    <aside className="tour" aria-label={`Tour step ${step} of ${total}`}>
      <span className="tour-step">
        {step}/{total}
      </span>
      <div>{children}</div>
    </aside>
  );
}
