import { singleImageCard } from '../components/single-image.js';
import { processShareImage } from '../services/image-processing.js';

/** The picture shown when a link to the site is shared (Facebook, iMessage, etc.). Added to the SEO page. */
export async function shareImageCard({ ownerId, settings }) {
  return singleImageCard({
    ownerId,
    settings,
    folder: 'seo',
    pathKey: 'seo_image_path',
    heading: 'Sharing image',
    help: 'The picture shown when someone shares a link to your website. It is cropped to a wide 1200×630 shape, so keep the important part in the middle.',
    aspect: 'aspect-[1200/630]',
    objectName: 'share',
    process: (file) => processShareImage(file),
  }).el;
}
