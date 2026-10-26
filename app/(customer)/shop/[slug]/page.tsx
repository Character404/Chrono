import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { createRepo } from "@/lib/data/repo";
import { customerTerms, earliestDate, validateCustomerOrder } from "@/lib/data/customer-orders";
import { findCustomerRecord, orderableBusiness } from "@/lib/data/marketplace";
import { getListing } from "@/lib/demo/listings";
import { addDays, formatRand, formatShortDate, todayInJohannesburg } from "@/lib/engine";
import { placeOrder } from "@/app/actions/customer";
import { SubmitButton } from "@/components/SubmitButton";

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
  const minDate = offering ? earliestDate(offering, today) : addDays(today, 2);

  return (
    <main className="page-narrow">
      <Link href="/shop" className="small muted">
        Back to businesses
      </Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="listing-hero" src={`/listings/${listing.slug}.svg`} alt={`${listing.name}: ${listing.kind.toLowerCase()} in ${listing.area}`} />
      <div className="listing-head">
        <span className="listing-avatar listing-avatar-lg" style={{ background: listing.colour }} aria-hidden="true">
          {listing.initials}
        </span>
        <div>
          <h1 className="h1" style={{ margin: 0 }}>
            {listing.name}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {listing.kind} · {listing.area}
          </p>
        </div>
      </div>

      <h2 className="h2">What they offer</h2>
      <div className="panel rows" style={{ paddingTop: 0, paddingBottom: 0 }}>
        {listing.offerings.map((o) => (
          <div key={o.id} className="row">
            <span>
              <strong>{o.name}</strong>
              <br />
              <span className="small muted">
                {o.description} {o.leadDays} days&apos; notice.
              </span>
            </span>
            <span className="num" style={{ fontWeight: 700 }}>
              {formatRand(o.priceCents)}
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
          <form method="get" action={`/shop/${listing.slug}`} className="order-pick">
            <div className="field">
              <label htmlFor="item">What would you like?</label>
              <select className="input" id="item" name="item" defaultValue={item ?? ""} required>
                <option value="" disabled>
                  Choose an item
                </option>
                {listing.offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {formatRand(o.priceCents)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="date">When do you need it?</label>
              <input className="input" id="date" name="date" type="date" min={minDate} defaultValue={date ?? ""} required />
            </div>
            <button className="btn btn-outline btn-wide" type="submit" data-tour="see-terms">
              See my terms
            </button>
          </form>

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
