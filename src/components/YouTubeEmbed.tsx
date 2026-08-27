export function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="youtube">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="Exercise demonstration"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
