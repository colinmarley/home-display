"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { ImmichAsset } from "@/lib/immich";

interface Props {
  photoIntervalMs: number;
  onWake: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PhotoSlideshow({ photoIntervalMs, onWake }: Props) {
  const [photos, setPhotos] = useState<ImmichAsset[]>([]);
  const [index, setIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const indexRef = useRef(0);
  const photosRef = useRef<ImmichAsset[]>([]);

  useEffect(() => {
    fetch("/api/photos")
      .then((r) => r.json())
      .then((data: ImmichAsset[]) => {
        const shuffled = shuffle(data);
        setPhotos(shuffled);
        photosRef.current = shuffled;
      })
      .catch(() => {});
  }, []);

  const advance = useCallback(() => {
    if (!photosRef.current.length) return;
    setOpacity(0);
    setTimeout(() => {
      indexRef.current = (indexRef.current + 1) % photosRef.current.length;
      setIndex(indexRef.current);
      setOpacity(1);
    }, 600);
  }, []);

  useEffect(() => {
    if (!photos.length) return;
    const id = setInterval(advance, photoIntervalMs);
    return () => clearInterval(id);
  }, [photos.length, photoIntervalMs, advance]);

  const current = photos[index];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onPointerDown={onWake}
    >
      {current && (
        <img
          src={`/api/photo/proxy?id=${encodeURIComponent(current.id)}`}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity,
            transition: "opacity 0.6s ease",
          }}
        />
      )}
      {!photos.length && (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>
          No photos configured
        </div>
      )}
    </div>
  );
}
