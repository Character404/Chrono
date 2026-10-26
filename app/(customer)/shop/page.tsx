import Link from "next/link";
import { LISTINGS } from "@/lib/demo/listings";
import { formatRand } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default function ShopPage() {
  return (
    <main className="page-narrow">
      <h1 className="h1">Order from local businesses</h1>
      <div className="listing-grid">
        {LISTINGS.map((l) => {
          const from = Math.min(...l.offerings.map((o) => o.priceCents));
          return (
            <Link key={l.slug} href={`/shop/${l.slug}`} className="listing-card listing-card-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="listing-cover" src={`/listings/${l.slug}.svg`} alt="" loading="lazy" />
              <span className="listing-card-row">
              <span className="listing-avatar" style={{ background: l.colour }} aria-hidden="true">
                {l.initials}
              </span>
              <span className="listing-body">
                <strong>{l.name}</strong>
                <span className="small muted">
                  {l.kind} · {l.area}
                </span>
                <span className="small">From {formatRand(from)}</span>
                <span className={`badge ${l.orderable ? "badge-SAFE" : ""}`} style={{ justifySelf: "start", marginTop: "0.3rem" }}>
                  {l.orderable ? "Orders open" : "Sample listing"}
                </span>
              </span>
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
