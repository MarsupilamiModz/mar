"use client";

import { useMemo, useState } from "react";
import {
  Globe,
  Instagram,
  Mail,
  MessageCircle,
  Twitch,
  Twitter,
  Youtube,
} from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PublicTeamMember } from "@/lib/team-profiles";

type Dept = { id: string; name: string; slug: string; description: string | null };

type Props = {
  departments: Dept[];
  members: PublicTeamMember[];
  contactTicketHref?: string;
};

export function TeamPageClient({ departments, members, contactTicketHref }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<PublicTeamMember | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return members;
    return members.filter((m) => m.department?.slug === filter);
  }, [filter, members]);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-neon-purple/20 blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-neon-blue/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <header className="text-center mb-12 space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-neon-purple">Xumari Modz</p>
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-white via-neon-purple to-neon-blue bg-clip-text text-transparent">
            Our Team
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The people behind the platform — development, design, support, and partnerships.
          </p>
        </header>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          {departments.map((d) => (
            <FilterChip key={d.id} active={filter === d.slug} onClick={() => setFilter(d.slug)}>
              {d.name}
            </FilterChip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">Team profiles coming soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelected(member)}
                className="group text-left glass rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 hover:border-neon-purple/50 hover:shadow-[0_0_40px_-12px_rgba(168,85,247,0.45)] hover:-translate-y-1"
              >
                <div className="relative h-24 bg-gradient-to-br from-neon-purple/30 to-transparent">
                  {member.bannerUrl && (
                    <SafeImage src={member.bannerUrl} alt="" fill className="object-cover opacity-60" sizes="400px" />
                  )}
                  <div className="absolute -bottom-8 left-4 h-16 w-16 rounded-full border-2 border-neon-purple/50 overflow-hidden bg-background">
                    {member.avatarUrl ? (
                      <SafeImage src={member.avatarUrl} alt={member.name} fill className="object-cover" sizes="64px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl font-bold text-neon-purple">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-10 p-4 space-y-1">
                  <p className="font-semibold group-hover:text-neon-purple transition-colors">{member.name}</p>
                  <p className="text-sm text-neon-purple/80">{member.position}</p>
                  {member.department && (
                    <p className="text-xs text-muted-foreground">{member.department.name}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="glass border-neon-purple/30 max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selected.name}</DialogTitle>
                <p className="text-sm text-neon-purple">{selected.position}</p>
              </DialogHeader>
              {selected.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <SocialLinks member={selected} />
              </div>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border/30">
                {selected.email && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${selected.email}`}>
                      <Mail className="h-4 w-4 mr-1" /> Email
                    </a>
                  </Button>
                )}
                {selected.discordUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selected.discordUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-1" /> Discord
                    </a>
                  </Button>
                )}
                {contactTicketHref && (
                  <Button variant="neon" size="sm" asChild>
                    <a href={contactTicketHref}>Open support ticket</a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm transition-all",
        active
          ? "bg-neon-purple text-white shadow-[0_0_20px_-4px_rgba(168,85,247,0.8)]"
          : "glass border border-white/10 text-muted-foreground hover:border-neon-purple/40"
      )}
    >
      {children}
    </button>
  );
}

function SocialLinks({ member }: { member: PublicTeamMember }) {
  const links = [
    { url: member.websiteUrl, icon: Globe, label: "Website" },
    { url: member.youtubeUrl, icon: Youtube, label: "YouTube" },
    { url: member.twitchUrl, icon: Twitch, label: "Twitch" },
    { url: member.instagramUrl, icon: Instagram, label: "Instagram" },
    { url: member.xUrl, icon: Twitter, label: "X" },
  ].filter((l) => l.url);

  return (
    <>
      {links.map(({ url, icon: Icon, label }) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 hover:border-neon-purple/50 hover:text-neon-purple transition-colors"
          aria-label={label}
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
      {member.customLinks?.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg border border-border/40 hover:border-neon-purple/50"
        >
          {link.label}
        </a>
      ))}
    </>
  );
}
