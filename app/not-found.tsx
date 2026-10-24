import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ paddingTop: "3rem" }}>
      <h1 className="h1">We couldn&apos;t find that page</h1>
      <p className="muted">It may have been removed, or it belongs to another account.</p>
      <Link href="/home" className="btn">
        Go to home
      </Link>
    </main>
  );
}
