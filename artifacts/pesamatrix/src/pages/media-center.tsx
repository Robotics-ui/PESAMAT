import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image, Video, ExternalLink, Play, Search, RefreshCw, Film } from "lucide-react";

interface MediaItem {
  id: number;
  title: string;
  description: string | null;
  mediaType: string; // image_url | video_url | video_link
  url: string;
  thumbnailUrl: string | null;
  category: string | null;
  publishedAt: string | null;
}

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function isVimeo(url: string) {
  return /vimeo\.com/.test(url);
}

function toEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

function MediaTypeIcon({ type }: { type: string }) {
  if (type === "image_url") return <Image className="h-4 w-4" />;
  if (type === "video_url") return <Video className="h-4 w-4" />;
  return <Film className="h-4 w-4" />;
}

function MediaTypeLabel({ type }: { type: string }) {
  if (type === "image_url") return "Image";
  if (type === "video_url") return "Video";
  return "Video Link";
}

function MediaCard({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const hasThumb = item.thumbnailUrl || item.mediaType === "image_url";

  return (
    <Card
      className="border-border overflow-hidden cursor-pointer group hover:border-blue-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/5"
      onClick={onClick}
    >
      {/* Thumbnail / preview */}
      <div className="relative h-44 bg-muted overflow-hidden">
        {hasThumb ? (
          <img
            src={item.thumbnailUrl ?? item.url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement!.classList.add("flex", "items-center", "justify-center");
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Play overlay for videos */}
        {item.mediaType !== "image_url" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
            <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Category badge */}
        {item.category && (
          <Badge className="absolute top-2 left-2 text-xs bg-black/50 text-white border-0 backdrop-blur-sm">
            {item.category}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-foreground text-sm line-clamp-2 leading-snug">{item.title}</p>
          <span className="shrink-0 text-muted-foreground/60 mt-0.5">
            <MediaTypeIcon type={item.mediaType} />
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground/50">
            <MediaTypeLabel type={item.mediaType} />
          </span>
          {item.publishedAt && (
            <span className="text-xs text-muted-foreground/50">
              {new Date(item.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MediaModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const embedUrl = item.mediaType === "video_link" ? toEmbedUrl(item.url) : null;
  const isExternalLink = item.mediaType === "video_link" && !embedUrl;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-base leading-snug pr-8">{item.title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Media display */}
          {item.mediaType === "image_url" && (
            <div className="rounded-lg overflow-hidden bg-muted">
              <img
                src={item.url}
                alt={item.title}
                className="w-full max-h-[480px] object-contain"
              />
            </div>
          )}

          {item.mediaType === "video_url" && (
            <div className="rounded-lg overflow-hidden bg-black">
              <video
                src={item.url}
                controls
                className="w-full max-h-[480px]"
                autoPlay={false}
              />
            </div>
          )}

          {item.mediaType === "video_link" && embedUrl && (
            <div className="rounded-lg overflow-hidden bg-black aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={item.title}
              />
            </div>
          )}

          {isExternalLink && (
            <div className="rounded-lg bg-muted p-6 text-center space-y-3">
              <Film className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">This video opens in an external player.</p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4" /> Open Video
              </Button>
            </div>
          )}

          {/* Meta */}
          <div className="space-y-2">
            {item.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground/60 pt-1">
              {item.category && (
                <Badge variant="outline" className="text-xs font-normal">{item.category}</Badge>
              )}
              {item.publishedAt && (
                <span>Published {new Date(item.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
              )}
              {(item.mediaType === "image_url" || (item.mediaType === "video_link" && (isYouTube(item.url) || isVimeo(item.url)))) && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Open original
                </a>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ALL = "All";

export default function MediaCenterPage() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [activeType, setActiveType] = useState(ALL);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const { data: items = [], isLoading, refetch } = useQuery<MediaItem[]>({
    queryKey: ["user-media"],
    queryFn: async () => {
      const res = await fetch("/api/media", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load media");
      return res.json();
    },
    enabled: !!token,
  });

  // Derived filter options
  const categories = [ALL, ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort()];
  const types = [ALL, "Images", "Videos"];

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === ALL || item.category === activeCategory;
    const matchType =
      activeType === ALL ||
      (activeType === "Images" && item.mediaType === "image_url") ||
      (activeType === "Videos" && item.mediaType !== "image_url");
    return matchSearch && matchCat && matchType;
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/15 flex items-center justify-center shrink-0">
              <Film className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Media Center</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Educational content, tutorials & updates</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Search + filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Search media…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Type filter */}
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeType === t
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-border text-muted-foreground hover:border-blue-500/50 hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}

            {/* Category filter — only show if there are categories */}
            {categories.length > 1 && (
              <span className="text-border self-center">|</span>
            )}
            {categories.length > 1 && categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeCategory === c
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-border text-muted-foreground hover:border-blue-500/50 hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border overflow-hidden">
                <div className="h-44 bg-muted animate-pulse" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Film className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {items.length === 0 ? "No media published yet" : "No results found"}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {items.length === 0
                ? "Check back soon — the admin team will publish tutorials and updates here."
                : "Try adjusting your search or filters."}
            </p>
            {search || activeCategory !== ALL || activeType !== ALL ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => { setSearch(""); setActiveCategory(ALL); setActiveType(ALL); }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground -mt-1">
              {filtered.length} {filtered.length === 1 ? "item" : "items"}
              {(search || activeCategory !== ALL || activeType !== ALL) && " found"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <MediaCard key={item.id} item={item} onClick={() => setSelected(item)} />
              ))}
            </div>
          </>
        )}
      </div>

      {selected && <MediaModal item={selected} onClose={() => setSelected(null)} />}
    </AppLayout>
  );
}
