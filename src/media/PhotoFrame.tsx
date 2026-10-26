import { useState } from "react";

// Keep camera portraits, squares and landscapes natural; crop only extreme ratios.
// The complete photo remains available through the surrounding preview button.
export function PhotoFrame({
  src,
  alt,
  loading,
  onError,
}: {
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
  onError?: () => void;
}) {
  const [ratio, setRatio] = useState(1);
  return (
    <img
      className="photo-frame"
      src={src}
      alt={alt}
      loading={loading}
      style={{ aspectRatio: ratio }}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (naturalWidth && naturalHeight)
          setRatio(
            Math.max(3 / 4, Math.min(1.91, naturalWidth / naturalHeight)),
          );
      }}
      onError={onError}
    />
  );
}
