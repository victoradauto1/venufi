import { VenueState, type VenueStateValue } from "@/hooks/web3/useVenue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionVariant = "primary" | "secondary" | "muted";

/** Semantic icon identifier — consumers map to their own SVG. */
export type ActionIcon = "invest" | "revenue" | "view";

export interface VenueAction {
  /** Display label — consistent across every surface. */
  label: string;
  /** Relative path segment appended to `/venue/[address]`. */
  href: string;
  /** Visual weight — drives button styling in consumers. */
  variant: ActionVariant;
  /** Semantic icon identifier for optional icon rendering. */
  icon: ActionIcon;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Returns the primary CTA for a venue based on its lifecycle state.
 *
 * Every UI surface (VenueCard, VenueOverview, deployment receipt, future
 * dashboard / admin / portfolio views) should derive its CTA from this
 * function to guarantee consistent labels and navigation targets.
 *
 * @param state        — on-chain venue state enum value
 * @param venueAddress — venue contract address (used to build `href`)
 */
export function getVenueAction(
  state: VenueStateValue,
  venueAddress: string,
): VenueAction {
  switch (state) {
    case VenueState.FUNDING:
      return {
        label: "Invest",
        href: `/venue/${venueAddress}/invest`,
        variant: "primary",
        icon: "invest",
      };

    case VenueState.ACTIVE:
      return {
        label: "Revenue",
        href: `/venue/${venueAddress}/revenue`,
        variant: "secondary",
        icon: "revenue",
      };

    case VenueState.ENDED:
      return {
        label: "View Details",
        href: `/venue/${venueAddress}`,
        variant: "muted",
        icon: "view",
      };
  }
}
