"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/actions/reviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

export function ReviewForm({ modId }: { modId: string }) {
  const [rating, setRating] = useState(5);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="glass rounded-xl p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await submitReview(modId, {
            rating,
            title: fd.get("title") as string,
            content: fd.get("content") as string,
          });
          if (r.success) {
            toast({ title: "Review submitted" });
            window.location.reload();
          } else toast({ title: "Error", description: r.error, variant: "destructive" });
        });
      }}
    >
      <p className="text-sm font-medium">Leave a review</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-lg ${n <= rating ? "text-neon-purple" : "text-muted-foreground"}`}
          >
            ★
          </button>
        ))}
      </div>
      <Input name="title" placeholder="Title (optional)" />
      <Textarea name="content" placeholder="Your review..." rows={3} />
      <Button type="submit" variant="neon" size="sm" disabled={pending}>
        Submit review
      </Button>
    </form>
  );
}
