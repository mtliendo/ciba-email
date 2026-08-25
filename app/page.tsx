import { auth0 } from "@/lib/auth0";
import { CibaButton } from "./ciba-button";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-2xl font-semibold tracking-tight">CIBA email hello</h1>
        <p className="max-w-md text-center text-zinc-500">
          Example app. Log in, then send a CIBA email to admin@focusotter.com.
        </p>
        <a
          href="/auth/login"
          className="rounded-full bg-zinc-900 px-8 py-3 text-base font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Log in
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">CIBA email hello</h1>
      <p className="max-w-md text-center text-zinc-500">
        Logged in as {session.user.email ?? session.user.sub}. Click to POST
        /bc-authorize for admin@focusotter.com, then poll /oauth/token until
        you approve the email.
      </p>
      <CibaButton />
      <a href="/auth/logout" className="text-sm text-zinc-400 underline">
        Log out
      </a>
    </main>
  );
}
