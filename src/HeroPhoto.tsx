type HeroPhotoSources = { small: string; medium: string; large: string };

export function HeroPhoto({ images, alt, className = "" }: {
  images: HeroPhotoSources;
  alt: string;
  className?: string;
}) {
  return (
    <figure className={`hero-photo ${className}`}>
      <img
        src={images.large}
        srcSet={`${images.small} 480w, ${images.medium} 768w, ${images.large} 1280w`}
        sizes="(max-width: 700px) calc(100vw - 38px), (max-width: 1200px) calc(100vw - 256px), calc(55vw - 163px)"
        width="1280"
        height="853"
        alt={alt}
        fetchPriority="high"
        decoding="async"
      />
    </figure>
  );
}
