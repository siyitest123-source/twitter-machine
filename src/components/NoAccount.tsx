import Link from "next/link";

export function NoAccount() {
  return (
    <div className="p-10 max-w-2xl">
      <h1 className="text-3xl font-semibold mb-2">No account selected</h1>
      <p className="text-muted mb-6">
        Twitter Factory hosts multiple handles, each trained with its own voice.
        Create your first account to get started.
      </p>
      <Link
        href="/accounts"
        className="inline-block px-4 py-2 bg-accent text-accent-fg rounded-md text-sm font-medium"
      >
        + Create an account
      </Link>
    </div>
  );
}
