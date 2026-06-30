"use client";

import { useState, useTransition } from "react";
import { youTubeEmbedUrl } from "@/lib/tutorials/youtube";
import { toggleTutorialLike, postTutorialComment } from "@/actions/tutorials";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Heart } from "lucide-react";

type Tutorial = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  type: string;
  youtubeVideoId: string | null;
  videoUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  avgWatchSec: number;
  comments: {
    id: string;
    content: string;
    createdAt: Date;
    user: { username: string; displayName: string | null; avatarUrl: string | null };
  }[];
};

export function TutorialDetail({ tutorial }: { locale: string; tutorial: Tutorial }) {
  const [pending, startTransition] = useTransition();
  const [likes, setLikes] = useState(tutorial.likeCount);
  const [comment, setComment] = useState("");

  const hasVideo =
    (tutorial.type === "YOUTUBE" || tutorial.type === "MIXED") && tutorial.youtubeVideoId;
  const hasHostedVideo =
    (tutorial.type === "VIDEO" || tutorial.type === "MIXED") && tutorial.videoUrl;

  return (
    <article className="mt-6 space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{tutorial.title}</h1>
        {tutorial.description ? (
          <p className="mt-3 text-muted-foreground leading-relaxed">{tutorial.description}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{tutorial.viewCount} Aufrufe</span>
          <span>{likes} Likes</span>
          <span>{tutorial.commentCount} Kommentare</span>
          {tutorial.avgWatchSec > 0 ? (
            <span>Ø {Math.round(tutorial.avgWatchSec)}s Wiedergabe</span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await toggleTutorialLike(tutorial.id);
                if (r.success) setLikes((n) => (r.data.liked ? n + 1 : n - 1));
              })
            }
          >
            <Heart className="h-4 w-4 mr-1" /> Like
          </Button>
        </div>
      </header>

      {hasVideo ? (
        <div className="card-surface overflow-hidden rounded-xl aspect-video">
          <iframe
            title={tutorial.title}
            src={youTubeEmbedUrl(tutorial.youtubeVideoId!)}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      {hasHostedVideo ? (
        <div className="card-surface overflow-hidden rounded-xl">
          <video controls preload="metadata" className="w-full" src={tutorial.videoUrl!} />
        </div>
      ) : null}

      {tutorial.content ? (
        <div className="card-surface rounded-xl p-6 prose prose-invert max-w-none">
          <div className="whitespace-pre-wrap leading-relaxed text-sm">{tutorial.content}</div>
        </div>
      ) : null}

      <section className="card-surface rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Kommentare</h2>
        <Textarea
          placeholder="Frage oder Feedback…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <Button
          variant="neon"
          size="sm"
          disabled={pending || comment.trim().length < 2}
          onClick={() =>
            startTransition(async () => {
              const r = await postTutorialComment(tutorial.id, comment);
              if (r.success) {
                setComment("");
                toast({ title: "Kommentar gesendet" });
              } else toast({ title: r.error, variant: "destructive" });
            })
          }
        >
          Kommentieren
        </Button>
        <ul className="space-y-3 pt-2">
          {tutorial.comments.map((c) => (
            <li key={c.id} className="border-b border-border/30 pb-3 text-sm">
              <p className="font-medium">{c.user.displayName ?? c.user.username}</p>
              <p className="text-muted-foreground mt-1">{c.content}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
