/** A tap-to-open section, so the answer comes first and details stay one tap away. */
export function Fold({ title, count, id, open, children }: { title: string; count?: number; id?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="fold" id={id} open={open}>
      <summary>
        <span>{title}</span>
        {count !== undefined && <span className="fold-count num">{count}</span>}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
