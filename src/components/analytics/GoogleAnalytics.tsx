import Script from "next/script";

// GA4 is rendered only after the visitor accepts cookies (see ConsentBanner and the locale layout).
// The ID has already been checked with isGaMeasurementId, so it is safe in the inline script.
export function GoogleAnalytics({ id }: { id: string }) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});`}
      </Script>
    </>
  );
}
