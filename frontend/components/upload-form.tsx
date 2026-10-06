"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  FileCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { extractFromFile, extractFromText, getSampleTranscript, ExtractionHistoryItem } from "@/lib/api";

interface UploadFormProps {
  onExtractionComplete: (item: ExtractionHistoryItem) => void;
}

export function UploadForm({ onExtractionComplete }: UploadFormProps) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setErrorMessage(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  const handleLoadSample = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const sample = await getSampleTranscript();
      setMode("text");
      setMeetingTitle(sample.title);
      setTextInput(sample.transcript);
    } catch {
      // Fallback local sample
      setMode("text");
      setMeetingTitle("Q4 Mobile Launch & Engineering Sync");
      setTextInput(`[09:00] Sarah (Product Lead): Good morning everyone. Today we need to lock down our Q4 mobile launch scope. Alex, where do we stand on the push notification service?
[09:02] Alex (Backend Eng): We agreed in standup to cap batches at 2,500. I will deploy the configuration update and run a verification pass by Thursday 5 PM.
[09:06] Elena (Design): User testing showed 34% drop-off on screen 3. We decided to combine screens 2 and 3 into a single permission prompt. I'll finalize the Figma prototypes by tomorrow afternoon.
[09:09] Marcus (Legal): Open question whether PostHog self-hosted is sufficient or if we need AWS Frankfurt dedicated DB for GDPR.
[09:13] Sarah: Decision made: Mobile MVP will launch without third-party analytics if GDPR approval is delayed past Nov 15th.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (mode === "file" && !selectedFile) {
      setErrorMessage("Please choose or drag-and-drop a transcript file (.txt, .docx, .pdf).");
      return;
    }

    if (mode === "text" && !textInput.trim()) {
      setErrorMessage("Please paste or type transcript text.");
      return;
    }

    setIsLoading(true);
    try {
      let result: ExtractionHistoryItem;
      if (mode === "file" && selectedFile) {
        result = await extractFromFile(selectedFile, meetingTitle.trim() || undefined);
      } else {
        result = await extractFromText(textInput.trim(), meetingTitle.trim() || undefined);
      }
      onExtractionComplete(result);
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Extraction failed. Ensure backend is running.";
      setErrorMessage(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setTextInput("");
    setMeetingTitle("");
    setErrorMessage(null);
  };

  return (
    <Card className="w-full border-zinc-800 bg-zinc-900/60 shadow-xl backdrop-blur-md">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Analyze Meeting Transcript
            </CardTitle>
            <CardDescription className="mt-1">
              Upload a recorded transcript file or paste notes to automatically extract decisions and tasks.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            disabled={isLoading}
            className="self-start sm:self-auto text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-950/40"
          >
            <FileCode className="w-3.5 h-3.5 mr-1.5" />
            Load Sample Transcript
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Optional Meeting Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Meeting Title / Reference (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Q4 Sprint Planning, Product Review, Client Sync..."
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              disabled={isLoading}
              className="bg-zinc-950/60"
            />
          </div>

          {/* Mode Tabs */}
          <div className="flex rounded-lg bg-zinc-950/70 p-1 border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "file"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Upload File (.txt, .docx, .pdf)
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "text"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Paste Raw Notes
            </button>
          </div>

          {/* Tab Content */}
          {mode === "file" ? (
            <div>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-zinc-700/80 hover:border-zinc-500 bg-zinc-950/40"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {isDragActive ? "Drop the file here..." : "Drag & drop your transcript file, or click to browse"}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Supports <span className="text-zinc-300 font-semibold">.txt</span>,{" "}
                      <span className="text-zinc-300 font-semibold">.docx</span>, or{" "}
                      <span className="text-zinc-300 font-semibold">.pdf</span> (up to 25MB)
                    </p>
                  </div>
                </div>
              </div>

              {selectedFile && (
                <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-zinc-800">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-zinc-200 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-zinc-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Textarea
                placeholder="Paste verbatim transcript or unorganized notes here...&#10;&#10;e.g.&#10;Alice: I will prepare the quarterly financial slide deck by Wednesday.&#10;Bob: We decided to use Postgres instead of MongoDB.&#10;Charlie: What is the target launch date for phase 2?"
                rows={9}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={isLoading}
                className="bg-zinc-950/60 font-mono text-xs leading-relaxed"
              />
              <div className="flex justify-between items-center mt-1 text-xs text-zinc-400 px-1">
                <span>{textInput.length} characters</span>
                {textInput && (
                  <button
                    type="button"
                    onClick={() => setTextInput("")}
                    className="hover:text-zinc-200 underline"
                  >
                    Clear text
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-200">Error</p>
                <p className="text-xs text-rose-300 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={isLoading || (!selectedFile && !textInput && !meetingTitle)}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[140px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract Action Items
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
