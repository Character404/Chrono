import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { customerTerms, earliestDate, validateCustomerOrder } from "@/lib/data/customer-orders";
import { findCustomerRecord, orderableBusiness } from "@/lib/data/marketplace";
import { coverFor, getListing } from "@/lib/demo/listings";
import { formatRand, formatShortDate, todayInJohannesburg } from "@/lib/engine";
import { placeOrder } from "@/app/actions/customer";
import { SubmitButton } from "@/components/SubmitButton";
import { TermsPicker } from "@/components/TermsPicker";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ item?: string; date?: string; error?: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const listing = getListing(slug);
  if (!listing) notFound();
  const { item, date, error } = await searchParams;
  const today = todayInJohannesburg();
  const offering = listing.offerings.find((o) => o.id === item);

  // Terms appear once an item and a date are chosen. Worked out on the server from the business's
  // own forecast; the customer sees only the terms, never the business's finances.
  let terms: ReturnType<typeof customerTerms> | null = null;
  let problem: string | null = null;
  if (listing.orderable && item && date) {
    problem = validateCustomerOrder(offering, date, today);
    if (!problem) {
      const business = await orderableBusiness(user);
      if (business) {
        const record = await findCustomerRecord(user, business.id);
        const ctx = await createRepo(prisma).loadContext(business, today);
        terms = customerTerms(ctx, offering!, date, record?.id ?? "new-customer");
      } else {
        problem = "This business isn't available right now.";
      }
    }
  }

  return (
    <main className="page-narrow">
      <Link href="/shop" className="small muted">
        Back to businesses
      </Link>
      <section className="biz-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverFor(listing)} alt={`${listing.name}: ${listing.kind.toLowerCase()} in ${listing.area}`} />
        <span className="featured-shade" aria-hidden="true" />
        <span className="biz-hero-text">
          <span className={`badge ${listing.orderable ? "badge-SAFE" : ""}`}>{listing.orderable ? "Orders open" : "Sample listing"}</span>
          <h1 className="biz-hero-name">{listing.name}</h1>
          <span className="featured-tagline">{listing.tagline}</span>
          <span className="featured-meta">
            {listing.kind} · {listing.area}
          </span>
        </span>
      </section>

      <h2 className="h2">What they offer</h2>
      <div className="offer-grid">
        {listing.offerings.map((o) => (
          <div key={o.id} className="offer-card" data-selected={o.id === item}>
            {o.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="offer-photo" src={o.photo} alt={o.name} loading="lazy" />
            ) : (
              <span className="offer-photo offer-photo-empty" style={{ background: listing.colour }} aria-hidden="true">
                {listing.initials}
              </span>
            )}
            <span className="offer-body">
              <strong>{o.name}</strong>
              <span className="small muted">{o.description}</span>
              <span className="offer-foot">
                <strong className="num">{formatRand(o.priceCents)}</strong>
                <span className="small muted">{o.leadDays} days&apos; notice</span>
              </span>
              {listing.orderable && (
                <Link href={`/shop/${listing.slug}?item=${o.id}${date ? `&date=${date}` : ""}#order`} className="btn btn-outline offer-choose" scroll={false}>
                  {o.id === item ? "Chosen" : "Choose"}
                </Link>
              )}
            </span>
          </div>
        ))}
      </div>

      {!listing.orderable ? (
        <p className="muted" style={{ marginTop: "1.25rem" }}>
          Sample listing: ordering isn&apos;t open for this business in the prototype.
        </p>
      ) : (
        <section className="panel" style={{ marginTop: "1.5rem" }} id="order" data-tour="order-panel">
          <h2 className="h2" style={{ marginTop: 0 }}>
            Place an order
          </h2>
          {(error || problem) && (
            <p className="error-box" role="alert">
              {error || problem}
            </p>
          )}
          <TermsPicker
            slug={listing.slug}
            options={listing.offerings.map((o) => ({ id: o.id, label: `${o.name} · ${formatRand(o.priceCents)}` }))}
            item={item}
            date={date}
            minDates={Object.fromEntries(listing.offerings.map((o) => [o.id, earliestDate(o, today)]))}
          />

          {terms && offering && (
            <div className="terms" data-tour="customer-terms">
              <div className="terms-rows">
                <span>Total</span>
                <strong className="num">{formatRand(terms.valueCents)}</strong>
                <span>Deposit now</span>
                <strong className="num">{formatRand(terms.depositCents)}</strong>
                <span>Balance on {formatShortDate(terms.eventDate)}</span>
                <strong className="num">{formatRand(terms.balanceCents)}</strong>
              </div>
              {terms.depositAdjusted && (
                <p className="small muted" style={{ margin: "0.6rem 0 0" }}>
                  Chrono set this deposit from {listing.name}&apos;s schedule, so your order can be confirmed without delay.
                </p>
              )}
              {terms.hardDate && (
                <p className="small muted" style={{ margin: "0.6rem 0 0" }}>
                  This date is busy for {listing.name}. You can still send the order, and they&apos;ll let you know.
                </p>
              )}
              <form action={placeOrder} style={{ marginTop: "0.9rem" }} data-tour="place-order">
                <input type="hidden" name="slug" value={listing.slug} />
                <input type="hidden" name="item" value={offering.id} />
                <input type="hidden" name="date" value={terms.eventDate} />
                <div className="field">
                  <label htmlFor="note">Note for {listing.name} (optional)</label>
                  <input className="input" id="note" name="note" maxLength={200} placeholder="e.g. venue, number of guests" />
                </div>
                <SubmitButton className="btn btn-wide" pendingLabel="Placing order">
                  Place order
                </SubmitButton>
              </form>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
