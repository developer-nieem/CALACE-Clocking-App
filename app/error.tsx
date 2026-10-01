"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-primary">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {error.message && !/digest|an error occurred in the server components/i.test(error.message)
          ? error.message
          : "The page could not be loaded. Your data was not changed. Try again, or go back to the dashboard."}
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference {error.digest}</p> : null}
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
