import { useQuery } from "@tanstack/react-query";

/**
 * Get the current site ID from the Webflow Designer API.
 * This is all we need - analytics scripts apply site-wide.
 */
export function useSites() {
  const { data, isLoading } = useQuery({
    queryKey: ["currentSite"],
    queryFn: async () => {
      const siteInfo = await webflow.getSiteInfo();
      return siteInfo.siteId;
    },
  });

  return {
    siteId: data ?? null,
    isLoading,
  };
}
