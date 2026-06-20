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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
import type { PublicTeamMember } from "@/lib/team-profiles";
import { TEAM_ROLE_GROUPS, teamRoleColor, teamRoleTitle } from "@/lib/team-page";

type Dept = { id: string; name: string; slug: string; description: string | null };

type Props = {
  departments: Dept[];
  members: PublicTeamMember[];
  contactTicketHref?: string;
};

export function TeamPageClient({ members, contactTicketHref }: Props) {
  const [selected, setSelected] = useState<PublicTeamMember | null>(null);

  const grouped = useMemo(
    () =>
      TEAM_ROLE_GROUPS.map((group) => ({
        ...group,
        members: members.filter((member) => member.roleGroup === group.key),
      })).filter((group) => group.members.length > 0),
    [members]
  );

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-neon-purple/20 blur-[120px]" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-neon-blue/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <header className="mb-16 space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-neon-purple">Xumari Modz</p>
          <h1 className="bg-gradient-to-r from-white via-neon-purple to-neon-blue bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
            Our Team
          </h1>
          <p className="mx-auto max-w-3xl text-muted-foreground">
            Meet the people leading the platform, supporting the community, building the product, and creating the content behind Xumari Modz.
          </p>
        </header>

        {grouped.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">Team profiles coming soon.</p>
        ) : (
          <div className="space-y-14">
            {grouped.map((group) => (
              <section key={group.key} className="space-y-6">
                <div className="space-y-3">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <div className="flex items-center justify-center gap-4">
                    <span className="h-px flex-1 bg-white/10" />
                    <h2 className="text-center text-xl font-bold tracking-[0.28em] text-white sm:text-2xl">
                      {teamRoleTitle(group.key)}
                    </h2>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setSelected(member)}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-background/40 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_0_40px_-12px_rgba(168,85,247,0.45)]"
                      style={{ boxShadow: `0 0 0 1px ${teamRoleColor(member.roleGroup, member.roleColor)}20 inset` }}
                    >
                      <div
                        className="relative h-24"
                        style={{ background: `linear-gradient(135deg, ${teamRoleColor(member.roleGroup, member.roleColor)}66, transparent)` }}
                      >
                        {member.bannerUrl && (
                          <SafeImage src={member.bannerUrl} alt="" fill className="object-cover opacity-60" sizes="400px" />
                        )}
                        <div className="absolute -bottom-8 left-4 h-16 w-16 overflow-hidden rounded-full border-2 bg-background" style={{ borderColor: teamRoleColor(member.roleGroup, member.roleColor) }}>
                          {member.avatarUrl ? (
                            <SafeImage src={member.avatarUrl} alt={member.name} fill className="object-cover" sizes="64px" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xl font-bold" style={{ color: teamRoleColor(member.roleGroup, member.roleColor) }}>
                              {member.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 p-4 pt-10">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold transition-colors group-hover:text-white">{member.name}</p>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                            style={{ backgroundColor: teamRoleColor(member.roleGroup, member.roleColor) }}
                          >
                            {member.roleBadge || teamRoleTitle(member.roleGroup).replace(/S$/, "")}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: teamRoleColor(member.roleGroup, member.roleColor) }}>
                          {member.position}
                        </p>
                        {member.description && (
                          <p className="line-clamp-3 text-sm text-muted-foreground">{member.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {member.discordUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={member.discordUrl} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="mr-1 h-4 w-4" /> Discord
                              </a>
                            </Button>
                          )}
                          {member.email && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={`mailto:${member.email}`}>
                                <Mail className="mr-1 h-4 w-4" /> Email
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="glass max-w-2xl border-neon-purple/30 overflow-hidden p-0">
          {selected && (
            <>
              <div
                className="relative h-40"
                style={{ background: `linear-gradient(135deg, ${teamRoleColor(selected.roleGroup, selected.roleColor)}88, transparent)` }}
              >
                {selected.bannerUrl && (
                  <SafeImage src={selected.bannerUrl} alt="" fill className="object-cover opacity-60" sizes="800px" />
                )}
              </div>
              <div className="relative p-6">
                <div className="-mt-20 mb-4 flex items-end gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 bg-background" style={{ borderColor: teamRoleColor(selected.roleGroup, selected.roleColor) }}>
                    {selected.avatarUrl ? (
                      <SafeImage src={selected.avatarUrl} alt={selected.name} fill className="object-cover" sizes="96px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl font-bold" style={{ color: teamRoleColor(selected.roleGroup, selected.roleColor) }}>
                        {selected.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="pb-2">
                    <DialogHeader className="space-y-2 text-left">
                      <DialogTitle className="text-2xl">{selected.name}</DialogTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm" style={{ color: teamRoleColor(selected.roleGroup, selected.roleColor) }}>
                          {selected.position}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                          style={{ backgroundColor: teamRoleColor(selected.roleGroup, selected.roleColor) }}
                        >
                          {selected.roleBadge || teamRoleTitle(selected.roleGroup).replace(/S$/, "")}
                        </span>
                      </div>
                    </DialogHeader>
                  </div>
                </div>

                {selected.description && (
                  <p className="mb-5 whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p>
                )}

                <div className="mb-5 flex flex-wrap gap-2">
                  <SocialLinks member={selected} />
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border/30 pt-4">
                  {selected.email && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`mailto:${selected.email}`}>
                        <Mail className="mr-1 h-4 w-4" /> Email
                      </a>
                    </Button>
                  )}
                  {selected.discordUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selected.discordUrl} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-1 h-4 w-4" /> Discord
                      </a>
                    </Button>
                  )}
                  {contactTicketHref && (
                    <Button variant="neon" size="sm" asChild>
                      <a href={contactTicketHref}>Open support ticket</a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SocialLinks({ member }: { member: PublicTeamMember }) {
  const links = [
    { url: member.websiteUrl, icon: Globe, label: "Website" },
    { url: member.youtubeUrl, icon: Youtube, label: "YouTube" },
    { url: member.twitchUrl, icon: Twitch, label: "Twitch" },
    { url: member.instagramUrl, icon: Instagram, label: "Instagram" },
    { url: member.xUrl, icon: Twitter, label: "X" },
  ].filter((link) => link.url);

  return (
    <>
      {links.map(({ url, icon: Icon, label }) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 transition-colors hover:border-neon-purple/50 hover:text-neon-purple"
          )}
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
          className="rounded-lg border border-border/40 px-3 py-1.5 text-xs hover:border-neon-purple/50"
        >
          {link.label}
        </a>
      ))}
    </>
  );
}
