import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { customerDisplayName } from "@/lib/data/marketplace";
import { coverFor, LISTINGS } from "@/lib/demo/listings";
import { formatRand } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const user = await requireUser();
  const first = customerDisplayName(user).split(" ")[0];
  const featured = LISTINGS.find((l) => l.orderable);
  const others = LISTINGS.filter((l) => !l.orderable);
  const from = (prices: number[]) => formatRand(Math.min(...prices));
  return (
    <main className="page-narrow">
      <p className="shop-hello">Hi {first}</p>
      <h1 className="h1" style={{ marginTop: 0 }}>
        Order from local businesses
      </h1>

      {featured && (
        <Link href={`/shop/${featured.slug}`} className="featured-card listing-card" data-tour="featured-business">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="featured-img" src={coverFor(featured)} alt={`${featured.name}: catering buffet`} />
          <span className="featured-shade" aria-hidden="true" />
          <span className="featured-text">
            <span className="badge badge-SAFE">Orders open</span>
            <strong className="featured-name">{featured.name}</strong>
            <span className="featured-tagline">{featured.tagline}</span>
            <span className="featured-meta">
              {featured.kind} · {featured.area} · From {from(featured.offerings.map((o) => o.priceCents))}
            </span>
          </span>
        </Link>
      )}

      <h2 className="h2">More businesses</h2>
      <div className="listing-grid">
        {others.map((l) => (
          <Link key={l.slug} href={`/shop/${l.slug}`} className="listing-card listing-card-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="listing-cover" src={coverFor(l)} alt="" loading="lazy" />
            <span className="listing-card-row">
              <span className="listing-avatar" style={{ background: l.colour }} aria-hidden="true">
                {l.initials}
              </span>
              <span className="listing-body">
                <strong>{l.name}</strong>
                <span className="small muted">
                  {l.kind} · {l.area}
                </span>
                <span className="small">From {from(l.offerings.map((o) => o.priceCents))}</span>
              </span>
              <span className="badge">Sample</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
