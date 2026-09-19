import { useEffect, useState } from "react";
import { getAccessToken } from "@/services/api";

export function AuthedImage({
  screenshotId,
  alt,
  className,
}: {
  screenshotId: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    fetch(`/api/v1/screenshots/${screenshotId}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Screenshot unavailable");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return objectUrl;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [screenshotId]);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  if (!src) return <div className={`rounded-xl bg-muted ${className ?? "min-h-40"}`} />;
  return <img src={src} alt={alt} className={className} />;
}
