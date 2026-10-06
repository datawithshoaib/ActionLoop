"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultsTable } from "@/components/results-table";
import { getHistoryItem, ExtractionHistoryItem } from "@/lib/api";

function ResultsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [item, setItem] = useState<ExtractionHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("No extraction ID specified in URL.");
      return;
    }

    async function fetchItem() {
      try {
        setLoading(true);
        const data = await getHistoryItem(id as string);
        setItem(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Could not find extraction session.");
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm text-zinc-400">Loading extraction details...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-lg font-semibold text-zinc-100">Session Not Found</h2>
        <p className="text-sm text-zinc-400">{error || "Unable to locate this extraction record."}</p>
        <Link href="/">
          <Button variant="outline" className="text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to ActionLoop
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Button variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Extractor
          </Button>
        </Link>
      </div>

      <ResultsTable
        data={item.extraction}
        sourceName={item.source_name}
        createdAt={item.created_at}
      />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-zinc-100">ActionLoop</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense
          fallback={
            <div className="min-h-[50vh] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          }
        >
          <ResultsContent />
        </Suspense>
      </main>
    </div>
  );
}
