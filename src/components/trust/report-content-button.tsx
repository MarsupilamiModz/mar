"use client";

import { useState, useTransition } from "react";
import { ReportCategory, ReportTargetType } from "@prisma/client";
import { submitContentReport } from "@/actions/reports";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Flag } from "lucide-react";

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "STOLEN", label: "Stolen mod" },
  { value: "MALWARE", label: "Malware" },
  { value: "VIRUS", label: "Virus" },
  { value: "BROKEN_DOWNLOAD", label: "Broken download" },
  { value: "COPYRIGHT", label: "Copyright violation" },
  { value: "SPAM", label: "Spam" },
  { value: "FAKE_CREATOR", label: "Fake creator" },
  { value: "ABUSIVE", label: "Abusive content" },
  { value: "TOS", label: "Terms of service" },
  { value: "OTHER", label: "Other" },
];

export function ReportContentButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("OTHER");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const r = await submitContentReport({ targetType, targetId, category, description });
      if (r.success) {
        toast({ title: "Report submitted", description: "Our team will review it shortly." });
        setOpen(false);
        setDescription("");
      } else {
        toast({ title: "Error", description: r.error, variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="h-4 w-4 mr-1" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Describe the issue in detail…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          <Button variant="neon" disabled={pending || description.length < 10} onClick={submit}>
            Submit report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
