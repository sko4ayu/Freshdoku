/**
 * Produce icons, drawn for this game as simple SVG shapes. One kind per
 * region colour (region id 0..11). These are placeholder art: final
 * illustrations come with the brand step, in the same slots.
 */
const LEAF = '<path d="M12.5 6.2c.2-2.3 1.9-3.7 4.4-3.6-.1 2.4-1.8 3.8-4.4 3.6z" fill="#3f8f3f"/>';
const STEM = '<path d="M12 7.5V4.2" stroke="#6b4a2b" stroke-width="1.6" stroke-linecap="round" fill="none"/>';

const ART: string[] = [
  // 0 tomato
  '<circle cx="12" cy="14" r="8" fill="#e2463a"/><path d="M12 5.2l1.3 2.6 2.9-.6-1.6 2.3-2.6-.9-2.6.9-1.6-2.3 2.9.6z" fill="#3f8f3f"/>',
  // 1 lemon
  '<path d="M2.6 13.5c1.4-4.6 5-7 9.4-7s8 2.4 9.4 7c-1.4 4.6-5 7-9.4 7s-8-2.4-9.4-7z" fill="#f0c419"/>' + LEAF,
  // 2 apple
  '<circle cx="9.4" cy="14.2" r="6.2" fill="#63b53c"/><circle cx="14.6" cy="14.2" r="6.2" fill="#63b53c"/>' + STEM + LEAF,
  // 3 peas
  '<path d="M2.5 13c4.2-6.6 14.8-6.6 19 0-4.2 6.6-14.8 6.6-19 0z" fill="#2f9a7d"/><circle cx="7.6" cy="13" r="2.4" fill="#9be6cc"/><circle cx="12" cy="13" r="2.6" fill="#9be6cc"/><circle cx="16.4" cy="13" r="2.4" fill="#9be6cc"/>',
  // 4 blueberry
  '<circle cx="12" cy="13" r="8.2" fill="#3b68cf"/><path d="M12 6.4l1.1 2 2.2.2-1.6 1.5.5 2.2-2.2-1.1-2.2 1.1.5-2.2-1.6-1.5 2.2-.2z" fill="#22408f"/>',
  // 5 eggplant
  '<path d="M12 6.5c4.6 0 6.8 4.4 6 9-.7 4-2.9 6.3-6 6.3s-5.3-2.3-6-6.3c-.8-4.6 1.400-9 6-9z" fill="#6a3d9e"/><path d="M7.6 8.2c1.200-2.600 7.600-2.600 8.800 0l-2.200 1.800-2.200-1.200-2.200 1.200z" fill="#3f8f3f"/>' + STEM,
  // 6 strawberry
  '<path d="M12 22c-5-2.900-8-6.800-8-10.600 0-3 3-4.600 8-4.600s8 1.600 8 4.600c0 3.800-3 7.700-8 10.600z" fill="#e33a6a"/><circle cx="9" cy="12" r=".9" fill="#ffe08a"/><circle cx="15" cy="12" r=".9" fill="#ffe08a"/><circle cx="12" cy="15.500" r=".9" fill="#ffe08a"/><path d="M12 4.200l1.300 2.400 2.900-.6-1.800 2.200H9.600L7.800 6l2.900.6z" fill="#3f8f3f"/>',
  // 7 potato
  '<ellipse cx="12" cy="13" rx="9.200" ry="6.600" transform="rotate(-14 12 13)" fill="#b3824d"/><circle cx="8.500" cy="12" r=".9" fill="#7d5730"/><circle cx="13.500" cy="15" r=".9" fill="#7d5730"/><circle cx="15.500" cy="10.500" r=".9" fill="#7d5730"/>',
  // 8 mushroom
  '<rect x="9" y="12" width="6" height="9.500" rx="2.200" fill="#efe9dd"/><path d="M2.800 13.200c0-5.200 4.100-9.200 9.200-9.200s9.200 4 9.200 9.200z" fill="#8a94a3"/><circle cx="8.500" cy="9.500" r="1.300" fill="#d5dae2"/><circle cx="14.500" cy="8" r="1.500" fill="#d5dae2"/>',
  // 9 pear
  '<path d="M12 4.500c2 0 3 1.800 3 3.800 0 2.200 4 3.900 4 7.900 0 3.700-3 5.800-7 5.800s-7-2.100-7-5.800c0-4 4-5.700 4-7.900 0-2 1-3.800 3-3.800z" fill="#9db51f"/>' + STEM,
  // 10 grapes
  '<circle cx="7.800" cy="9.500" r="3.300" fill="#2f95cc"/><circle cx="12" cy="9.500" r="3.300" fill="#3aa3da"/><circle cx="16.200" cy="9.500" r="3.300" fill="#2f95cc"/><circle cx="9.900" cy="14" r="3.300" fill="#3aa3da"/><circle cx="14.100" cy="14" r="3.300" fill="#2f95cc"/><circle cx="12" cy="18.500" r="3.300" fill="#3aa3da"/>' + STEM,
  // 11 carrot
  '<path d="M6.500 8.500c0-1.400 1.200-2 5.500-2s5.500.6 5.500 2c0 3.500-3.300 13.500-5.500 13.500S6.500 12 6.500 8.500z" fill="#ef7a1a"/><path d="M12 6.500V3M9.500 6.500L8 3.500M14.500 6.500L16 3.500" stroke="#3f8f3f" stroke-width="1.800" stroke-linecap="round" fill="none"/>',
];

export const KIND_NAMES = [
  'tomato',
  'lemon',
  'apple',
  'peas',
  'blueberry',
  'eggplant',
  'strawberry',
  'potato',
  'mushroom',
  'pear',
  'grapes',
  'carrot',
];

const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;

/** The good fruit or vegetable of a region. */
export function kindIcon(region: number): string {
  return svg(ART[region % ART.length]);
}

/** The player's "this one is wormy" mark. Drawn in the current text colour. */
export const WORM_ICON = svg(
  '<path d="M4.500 15.500c1.800-4.600 4.200-4.600 6 0s4.200 4.600 6 0" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" fill="none"/><circle cx="18.300" cy="12.600" r="2.100" fill="currentColor"/>',
);
