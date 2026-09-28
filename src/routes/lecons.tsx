import { createFileRoute, redirect } from "@tanstack/react-router";

// L'ancienne interface de leçons est retirée : toute visite renvoie aux dossiers.
export const Route = createFileRoute("/lecons")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
