import { ImageResponse } from 'next/og';

/**
 * Generated favicon.
 *
 * Not cosmetic: Google renders the site's favicon next to the title in mobile
 * search results and in AI Overview source cards, so a missing icon costs
 * click-through on every impression. Generating it here keeps it in the brand
 * palette without adding a binary asset to the repo.
 */

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a1628',
          color: '#2ecc71',
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: -1,
          fontFamily: 'sans-serif',
        }}
      >
        NW
      </div>
    ),
    size,
  );
}
