import { toPng, toJpeg } from 'html-to-image';

const CREAM = '#FBF6E9';

/**
 * Export a DOM element (front, back, or pair) as a PNG or JPG download.
 * Uses html-to-image, which lets the browser itself render the element,
 * so wave shapes (SVG), CSS filters, opacity and text layout match the screen.
 */
export async function exportCardImage(elementId, fileName, format = 'png') {
  const node = document.getElementById(elementId);
  if (!node) throw new Error(`Export element "${elementId}" not found`);

  // Make sure web fonts (Inter / Playfair Display) are loaded before capture
  if (document.fonts?.ready) await document.fonts.ready;

  const options = {
    pixelRatio: 3,          // crisp output (~960 x 1500 px per card)
    cacheBust: true,
    quality: 1,
    // JPG has no transparency, so give it the cream background.
    // PNG keeps the rounded corners transparent.
    backgroundColor: format === 'jpg' ? CREAM : undefined,
  };

  // Warm-up pass: the first capture can miss images/fonts (notably in Safari)
  await toPng(node, options).catch(() => { });

  const dataUrl = format === 'jpg' ? await toJpeg(node, options) : await toPng(node, options);

  const link = document.createElement('a');
  link.download = `${fileName}.${format}`;
  link.href = dataUrl;
  link.click();
}
