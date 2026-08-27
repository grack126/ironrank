"use client";
import { useState } from "react";
import { IconPlay } from "./icons";

// Lazy YouTube embed: shows the thumbnail until tapped, then loads the iframe.
// Never autoplays with sound on first paint.
export function VideoEmbed({ videoId, title = "Exercise demonstration" }: { videoId: string; title?: string }) {
  const [active, setActive] = useState(false);

  if (active) {
    return (
      <div className="youtube">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      className="video-thumb"
      onClick={() => setActive(true)}
      aria-label={`Play ${title}`}
      style={{ padding: 0, minHeight: 0 }}
    >
      <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" />
      <span className="play" aria-hidden>
        <IconPlay size={44} strokeWidth={1.75} />
      </span>
    </button>
  );
}
