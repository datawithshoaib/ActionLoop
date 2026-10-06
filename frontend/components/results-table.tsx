"use client";

import React, { useState } from "react";
import { 
  CheckCircle, 
  Clock, 
  HelpCircle, 
  CheckSquare, 
  Copy, 
  Download, 
  Mail, 
  Share2, 
  Calendar, 
  User, 
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Loader2,
  FileCheck
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter, DialogCloseButton } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MeetingExtraction, draftEmail, EmailDraftResponse } from "@/lib/api";

interface ResultsTableProps {
  data: MeetingExtraction;
  sourceName?: string;
  createdAt?: string;
}

export function ResultsTable({ data, sourceName, createdAt }: ResultsTableProps) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("Team");
  const [emailSender, setEmailSender] = useState("ActionLoop Lead");
  const [emailTone, setEmailTone] = useState<"professional" | "concise" | "casual">("professional");
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);
  const [emailDraftResult, setEmailDraftResult] = useState<EmailDraftResponse | null>(null);
  const [emailCopyStatus, setEmailCopyStatus] = useState(false);

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || "medium").toLowerCase();
    switch (p) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "low":
        return <Badge variant="success">Low</Badge>;
      case "medium":
      default:
        return <Badge variant="warning">Medium</Badge>;
    }
  };

  const handleCopyMarkdown = async () => {
    let md = `# ${data.meeting_title || "Meeting Summary"}\n\n`;
    md += `## Executive Summary\n${data.meeting_summary}\n\n`;

    md += `## Decisions Made\n`;
    if (data.decisions.length === 0) {
      md += `*None recorded.*\n\n`;
    } else {
      data.decisions.forEach((d) => {
        md += `- **${d.summary}**${d.context ? ` (${d.context})` : ""}\n`;
      });
      md += `\n`;
    }

    md += `## Action Items\n`;
    if (data.action_items.length === 0) {
      md += `*No action items.*\n\n`;
    } else {
      md += `| Task | Owner | Due Date | Priority |\n|---|---|---|---|\n`;
      data.action_items.forEach((a) => {
        md += `| ${a.task} | ${a.owner} | ${a.due_date || "-"} | ${(a.priority || "medium").toUpperCase()} |\n`;
      });
      md += `\n`;
    }

    if (data.open_questions && data.open_questions.length > 0) {
      md += `## Open Questions & Blockers\n`;
      data.open_questions.forEach((q) => {
        md += `- ${q}\n`;
      });
      md += `\n`;
    }

    await navigator.clipboard.writeText(md);
    setCopyStatus("Copied Markdown!");
    setTimeout(() => setCopyStatus(null), 3000);
  };

  const handleExportCSV = () => {
    const headers = ["Task", "Owner", "Due Date", "Priority", "Status"];
    const rows = data.action_items.map((item) => [
      `"${(item.task || "").replace(/"/g, '""')}"`,
      `"${(item.owner || "").replace(/"/g, '""')}"`,
      `"${(item.due_date || "N/A").replace(/"/g, '""')}"`,
      `"${(item.priority || "medium").replace(/"/g, '""')}"`,
      `"Pending"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const cleanTitle = (data.meeting_title || "action-items")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    link.setAttribute("download", `${cleanTitle}-action-items.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateEmail = async () => {
    setIsDraftingEmail(true);
    try {
      const response = await draftEmail({
        meeting_title: data.meeting_title,
        meeting_summary: data.meeting_summary,
        decisions: data.decisions,
        action_items: data.action_items,
        open_questions: data.open_questions,
        recipient_name: emailRecipient,
        sender_name: emailSender,
        tone: emailTone,
      });
      setEmailDraftResult(response);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDraftingEmail(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!emailDraftResult) return;
    const fullText = `Subject: ${emailDraftResult.subject}\n\n${emailDraftResult.body}`;
    await navigator.clipboard.writeText(fullText);
    setEmailCopyStatus(true);
    setTimeout(() => setEmailCopyStatus(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top action header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-400" />
            {data.meeting_title || "Extracted Meeting Action Plan"}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {sourceName ? `Source: ${sourceName} • ` : ""}
            {createdAt ? new Date(createdAt).toLocaleString() : "Just now"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyMarkdown}
            className="text-xs"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            {copyStatus || "Copy Markdown"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setIsEmailModalOpen(true);
              if (!emailDraftResult) handleGenerateEmail();
            }}
            className="text-xs bg-indigo-600 hover:bg-indigo-500"
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Auto-Draft Follow-up Email
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="border-indigo-500/20 bg-linear-to-b from-indigo-950/20 to-zinc-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-200 leading-relaxed font-sans">
            {data.meeting_summary}
          </p>
        </CardContent>
      </Card>

      {/* Decisions Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-100">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Decisions Made
            </CardTitle>
            <Badge variant="secondary">{data.decisions.length}</Badge>
          </div>
          <CardDescription>
            Key agreements and direction decided during the conversation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.decisions.length === 0 ? (
            <p className="text-sm text-zinc-500 italic py-2">No explicit decisions recorded.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.decisions.map((decision, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-zinc-950/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                >
                  <p className="text-sm font-medium text-zinc-200 leading-snug">
                    {decision.summary}
                  </p>
                  {decision.context && (
                    <p className="text-xs text-zinc-400 mt-1.5">
                      {decision.context}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Items Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-100">
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              Action Items & Commitments
            </CardTitle>
            <Badge variant="secondary">{data.action_items.length}</Badge>
          </div>
          <CardDescription>
            Assigned tasks, ownership, deadlines, and urgency levels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.action_items.length === 0 ? (
            <p className="text-sm text-zinc-500 italic py-2">No action items detected.</p>
          ) : (
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Action Item</TableHead>
                    <TableHead className="w-[20%]">Owner</TableHead>
                    <TableHead className="w-[20%]">Due Date</TableHead>
                    <TableHead className="w-[15%] text-right">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.action_items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium text-zinc-100">
                        {item.task}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-800/60 px-2 py-1 rounded-md">
                          <User className="w-3 h-3 text-zinc-400" />
                          {item.owner || "Unassigned"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.due_date ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            {item.due_date}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {getPriorityBadge(item.priority)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Questions / Unresolved Topics */}
      {data.open_questions && data.open_questions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-100">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Open Questions & Parking Lot
              </CardTitle>
              <Badge variant="warning">{data.open_questions.length}</Badge>
            </div>
            <CardDescription>
              Unresolved matters flagged for follow-up or offline decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.open_questions.map((question, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-950/40 border border-zinc-800 text-sm text-zinc-300"
                >
                  <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Auto-Draft Follow-Up Email Dialog */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogCloseButton onClose={() => setIsEmailModalOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            Auto-Drafted Follow-Up Email
          </DialogTitle>
          <DialogDescription>
            Ready-to-send summary email drafted with decisions and commitments.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-4">
          {/* Controls to re-generate with custom settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-zinc-950/70 border border-zinc-800">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Recipient</label>
              <Input
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="Team"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Sender Name</label>
              <Input
                value={emailSender}
                onChange={(e) => setEmailSender(e.target.value)}
                placeholder="Your Name"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tone</label>
              <select
                value={emailTone}
                onChange={(e) => setEmailTone(e.target.value as any)}
                className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200 focus:outline-none"
              >
                <option value="professional">Professional</option>
                <option value="concise">Concise & Direct</option>
                <option value="casual">Casual / Friendly</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateEmail}
              disabled={isDraftingEmail}
              className="text-xs"
            >
              {isDraftingEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                  Regenerate Email
                </>
              )}
            </Button>
          </div>

          {emailDraftResult ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Subject</label>
                <Input
                  readOnly
                  value={emailDraftResult.subject}
                  className="bg-zinc-950 font-medium text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1 block">Email Body</label>
                <Textarea
                  readOnly
                  value={emailDraftResult.body}
                  rows={12}
                  className="font-mono text-xs leading-relaxed bg-zinc-950"
                />
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
              <p className="text-sm text-zinc-400">Drafting follow-up email...</p>
            </div>
          )}
        </DialogContent>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsEmailModalOpen(false)}
            className="text-xs"
          >
            Close
          </Button>
          <Button
            onClick={handleCopyEmail}
            disabled={!emailDraftResult}
            className="bg-indigo-600 hover:bg-indigo-500 text-xs"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            {emailCopyStatus ? "Copied Email!" : "Copy Full Email"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
