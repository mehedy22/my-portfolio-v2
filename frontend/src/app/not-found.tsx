import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="font-display text-6xl font-semibold text-accent">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted">
        That page does not exist, or it has not been published.
      </p>
      <div className="mt-8 flex justify-center">
        <ButtonLink href="/">Back home</ButtonLink>
      </div>
    </div>
  );
}
