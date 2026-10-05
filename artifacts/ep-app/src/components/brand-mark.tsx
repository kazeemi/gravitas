// The Gravitas logo mark above the wordmark, shared by the interview landing
// page and onboarding welcome so they match.
//
// The logo file has wide transparent margins, so it is cropped to the mark
// itself (content box 90x31 inside the 180x120 image, shown at 1.556x).
export function BrandMark() {
  return (
    <div className="space-y-2 text-center">
      <div
        role="img"
        aria-hidden="true"
        className="mx-auto"
        style={{
          width: 140,
          height: 48,
          backgroundImage: "url(/gravitas-logo-light.png)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "280px auto",
          backgroundPosition: "-90px -67px",
        }}
      />
      <span
        className="block text-5xl font-semibold leading-none text-foreground"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
      >
        Gravitas
      </span>
    </div>
  );
}
