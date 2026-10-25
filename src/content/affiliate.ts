// Official merchandise and ticket offers (DESIGN.md section 14). The list is empty
// until partner accounts are approved, so no affiliate links appear yet.
export type AffiliateOffer = {
  title: string;
  url: string;
  // Only titles that have a verified official platform or shop can have offers.
  animeSlug: string;
};

export const AFFILIATE_OFFERS: AffiliateOffer[] = [];

export function offersFor(animeSlug: string): AffiliateOffer[] {
  return AFFILIATE_OFFERS.filter((offer) => offer.animeSlug === animeSlug);
}
