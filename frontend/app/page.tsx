"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  History, 
  CheckCircle2, 
  ArrowRight, 
  Trash2, 
  Layers, 
  Terminal, 
  ExternalLink,
  Cpu,
  RefreshCw
} from "lucide-react";
import { UploadForm } from "@/components/upload-form";
import { ResultsTable } from "@/components/results-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExtractionHistoryItem, 
  getHistory, 
  deleteHistoryItem, 
  checkBackendHealth 
} from "@/lib/api";

export default function Home() {
  const [currentResult, setCurrentResult] = useState<ExtractionHistoryItem | null>(null);
  const [historyList, setHistoryList] = useState<ExtractionHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState<{ status: string; groq_configured: boolean; model: string } | null>(null);

  const loadHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const items = await getHistory();
      setHistoryList(items);
    } catch {
      // Backend might be warming up or offline
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadHealth = async () => {
    try {
      const health = await checkBackendHealth();
      setBackendHealth(health);
    } catch {
      setBackendHealth(null);
    }
  };

  useEffect(() => {
    loadHealth();
    loadHistory();
  }, []);

  const handleExtractionComplete = (item: ExtractionHistoryItem) => {
    setCurrentResult(item);
    setHistoryList((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
    // Smooth scroll down to results
    setTimeout(() => {
      window.scrollTo({ top: 400, behavior: "smooth" });
    }, 100);
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteHistoryItem(id);
      setHistoryList((prev) => prev.filter((item) => item.id !== id));
      if (currentResult?.id === id) {
        setCurrentResult(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-linear-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                ActionLoop
              </span>
              <span className="ml-2 text-xs text-zinc-500 font-mono">v1.0</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {backendHealth ? (
              <div className="flex items-center gap-2">
                <Badge
                  variant={backendHealth.groq_configured ? "success" : "warning"}
                  className="hidden sm:inline-flex"
                >
                  <Cpu className="w-3 h-3 mr-1" />
                  {backendHealth.groq_configured ? `Groq: ${backendHealth.model}` : "Local Extractor Mode"}
                </Badge>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  API Online
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
                Connecting API...
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadHistory();
                loadHealth();
              }}
              className="text-xs border-zinc-800 hover:bg-zinc-900"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Meeting Action Item Extractor
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-100">
            Turn meeting transcripts into{" "}
            <span className="bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              structured commitments
            </span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Extract decisions, owners, deadlines, and open questions automatically from raw transcripts or uploaded notes (.txt, .docx, .pdf), then auto-draft follow-up emails.
          </p>
        </div>

        {/* Workspace Layout: Form on Left, History & Status on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Upload / Input Card */}
          <div className="lg:col-span-8">
            <UploadForm onExtractionComplete={handleExtractionComplete} />
          </div>

          {/* History / Sessions Panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-semibold text-sm text-zinc-200">Past Sessions</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {historyList.length}
                </Badge>
              </div>

              {isHistoryLoading ? (
                <p className="text-xs text-zinc-500 py-4 text-center">Loading past sessions...</p>
              ) : historyList.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-800/80 rounded-lg">
                  <Layers className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No past extractions yet</p>
                  <p className="text-[11px] text-zinc-600 mt-1">Upload a file or run the sample</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {historyList.map((item) => {
                    const isSelected = currentResult?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setCurrentResult(item)}
                        className={`group relative p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "bg-indigo-950/40 border-indigo-500/40"
                            : "bg-zinc-950/50 border-zinc-800/70 hover:border-zinc-700 hover:bg-zinc-950/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-indigo-300">
                            {item.extraction.meeting_title || item.source_name}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHistory(e, item.id)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 transition-opacity p-0.5"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-zinc-400">
                          <span>{item.extraction.action_items.length} tasks</span>
                          <span>•</span>
                          <span>{item.extraction.decisions.length} decisions</span>
                          <span>•</span>
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Tech Info Box */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 text-xs text-zinc-400 space-y-2">
              <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Backend Configuration
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Configure your <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">GROQ_API_KEY</code> in <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300">backend/.env</code> for high-speed Groq Llama 3.3 extraction.
              </p>
            </div>
          </div>
        </div>

        {/* Results Display Area */}
        {currentResult && (
          <div id="results-section" className="pt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                Extraction Results
              </h2>
              <Link
                href={`/results?id=${currentResult.id}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 hover:underline"
              >
                Open dedicated page
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <ResultsTable
              data={currentResult.extraction}
              sourceName={currentResult.source_name}
              createdAt={currentResult.created_at}
            />
          </div>
        )}
      </main>
    </div>
  );
}
