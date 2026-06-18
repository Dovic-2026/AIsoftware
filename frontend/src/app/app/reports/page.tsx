"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { reportsApi } from "@/lib/api";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/icons";

function renderMarkdown(text: string) {
  return text
    .replace(/### (.*)/g, '<h3 class="text-[14px] font-extrabold text-gray-900 mt-4 mb-1">$1</h3>')
    .replace(/## (.*)/g, '<h2 class="text-[16px] font-extrabold text-gray-900 mt-5 mb-2">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/^- (.*)/gm, '<div class="flex gap-2 mb-1"><span class="text-[#25D366]">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br />');
}

export default function ReportsPage() {
  const { restaurant } = useAuthStore();
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState("");
  const [activeReport, setActiveReport] = useState<any>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", restaurant?.id],
    queryFn: () => reportsApi.list(restaurant!.id).then((r) => r.data),
    enabled: !!restaurant?.id,
  });

  const { mutate: generate, isPending: generating } = useMutation({
    mutationFn: () => reportsApi.generate(restaurant!.id),
    onSuccess: (res: any) => { toast.success("Report generated!"); setActiveReport(res.data); },
    onError: () => toast.error("Failed to generate report"),
  });

  const { mutate: askAI, isPending: querying } = useMutation({
    mutationFn: () => reportsApi.query(restaurant!.id, { query }),
    onSuccess: (res: any) => setQueryResult(res.data.answer || res.data.response || ""),
    onError: () => toast.error("Query failed"),
  });

  const { mutate: sendWA, isPending: sending } = useMutation({
    mutationFn: () => reportsApi.sendWhatsapp(restaurant!.id),
    onSuccess: () => toast.success("📱 Report sent to your WhatsApp!"),
    onError: () => toast.error("Failed to send — check WhatsApp config"),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white px-5 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[20px] font-extrabold text-gray-900">AI Reports</div>
          <div className="flex gap-2">
            <button onClick={() => sendWA()} disabled={sending} className="bg-[#25D366] text-white px-3 py-2 rounded-xl text-[12px] font-bold shadow-sm flex items-center gap-1.5">
              {sending ? <Spinner /> : "📱"}{sending ? "Sending..." : "Send WA"}
            </button>
            <button onClick={() => generate()} disabled={generating} className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-3 py-2 rounded-xl text-[13px] font-bold shadow-sm flex items-center gap-1.5">
              {generating ? <><Spinner /> </> : "🤖"}{generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
        <p className="text-[12px] text-gray-400">Auto-sends every night 11 PM • Tap "Send WA" for instant report</p>
      </div>

      <div className="flex-1 overflow-y-auto hide-scroll">
        {/* AI Query Box */}
        <div className="mx-4 mt-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-[1.5px] border-indigo-100 rounded-[20px] p-4">
          <div className="text-[13px] font-bold text-indigo-900 mb-2">🧠 Ask AI Anything</div>
          <div className="flex gap-2 mb-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askAI()}
              className="flex-1 bg-white rounded-xl px-4 py-2.5 text-[13px] text-gray-900 outline-none border-[1.5px] border-indigo-100 focus:border-indigo-400"
              placeholder="What was today's revenue? Top items?" />
            <button onClick={() => askAI()} disabled={querying || !query.trim()} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-bold flex items-center gap-1 disabled:opacity-50">
              {querying ? <Spinner /> : "Ask"}
            </button>
          </div>
          {queryResult && (
            <div className="bg-white rounded-xl p-3 text-[13px] text-gray-800 leading-relaxed border border-indigo-100">
              {queryResult}
            </div>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {["Today's revenue?", "Top selling items?", "Staff who were absent?", "Supplier dues total?"].map((q) => (
              <button key={q} onClick={() => { setQuery(q); }} className="text-[11px] bg-white border border-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">{q}</button>
            ))}
          </div>
        </div>

        {/* Active/Latest Report */}
        {activeReport && (
          <div className="mx-4 mt-4 bg-white border-[1.5px] border-gray-100 rounded-[20px] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm">🤖</div>
              <div>
                <div className="text-[13px] font-bold text-gray-900">AI Daily Report</div>
                <div className="text-[11px] text-gray-400">Just generated</div>
              </div>
            </div>
            <div className="text-[13px] text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(activeReport.content || "") }} />
          </div>
        )}

        {/* Report History */}
        <div className="px-4 mt-4 mb-4">
          <div className="text-[15px] font-extrabold text-gray-900 mb-3">Past Reports</div>
          {isLoading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-16 rounded-2xl shimmer mb-2" />) :
            reports.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                <div className="text-3xl mb-2">📊</div>
                <div>No reports yet — generate your first!</div>
              </div>
            ) : reports.map((r: any) => (
              <button key={r.id} onClick={() => setActiveReport(r)}
                className="w-full bg-white border-[1.5px] border-gray-100 rounded-[18px] p-4 mb-2 shadow-sm text-left flex items-center justify-between active:bg-gray-50">
                <div>
                  <div className="text-[14px] font-bold text-gray-900">Report · {r.report_date ? format(new Date(r.report_date), "d MMM yyyy") : ""}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">Revenue: ₹{r.metrics?.total_revenue?.toLocaleString() || "N/A"}</div>
                </div>
                <div className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${r.whatsapp_sent ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {r.whatsapp_sent ? "Sent via WA" : "Local"}
                </div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}
