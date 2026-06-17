"use client";
import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { waApi } from "@/lib/api";
import { WhatsAppIcon } from "@/components/ui/icons";
import { format } from "date-fns";

interface Message {
  id: string;
  type: "in" | "out";
  text: string;
  time: string;
}

const INITIAL_MESSAGES: Message[] = [
  { id: "1", type: "in", time: "9:41 AM", text: "👋 Welcome to *DOVIC AI Restaurant OS!*\n\nI'm your AI restaurant assistant. I can help you:\n• Record sales & expenses\n• Check stock levels\n• Get daily AI reports\n• Mark attendance\n\nReply *\"Help\"* to see all commands." },
];

const QUICK_COMMANDS = [
  { label: "📊 Today's report", cmd: "Today's report" },
  { label: "📦 Stock check", cmd: "Stock check" },
  { label: "✅ I'm present", cmd: "Present today" },
  { label: "🏆 Top items", cmd: "Top selling items" },
  { label: "💸 Supplier dues", cmd: "Supplier dues" },
  { label: "❓ Help", cmd: "Help" },
];

function formatWa(text: string) {
  return text
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}

export default function WhatsAppPage() {
  const { restaurant, user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), type: "out", text, time: format(new Date(), "h:mm a") };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const phone = user?.phone?.replace(/\D/g, "") || "919876543210";
      const res = await waApi.test(phone, text);
      const reply = res.data.reply;
      const aiMsg: Message = { id: (Date.now() + 1).toString(), type: "in", text: reply, time: format(new Date(), "h:mm a") };
      setMessages((m) => [...m, aiMsg]);
    } catch {
      const aiMsg: Message = { id: (Date.now() + 1).toString(), type: "in", text: "Sorry, I'm having trouble connecting right now. Please try again.", time: format(new Date(), "h:mm a") };
      setMessages((m) => [...m, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* WA Header */}
      <div className="bg-[#075E54] px-5 pt-4 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
            <WhatsAppIcon className="w-6 h-6" fill="white" />
          </div>
          <div>
            <div className="text-[16px] font-extrabold text-white">DOVIC AI Assistant</div>
            <div className="text-[11px] text-green-200">{restaurant?.name} · Manage by messaging</div>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
            <span className="text-[11px] text-white font-semibold">Online</span>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto hide-scroll px-4 py-3" style={{ background: "#ECE5DD" }}>
        <div className="text-center mb-3">
          <span className="text-[11px] bg-[#D9DBD3] text-[#667781] px-3 py-1 rounded-full">Today</span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex mb-2 ${msg.type === "out" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[82%] px-3.5 py-2.5 text-[13px] text-gray-900 relative animate-bounce-in ${msg.type === "out" ? "wa-bubble-out rounded-tl-xl rounded-bl-xl rounded-br-xl" : "wa-bubble-in rounded-tr-xl rounded-br-xl rounded-bl-xl"}`}>
              <div dangerouslySetInnerHTML={{ __html: formatWa(msg.text) }} className="leading-relaxed" />
              <div className="text-[10px] text-[#667781] text-right mt-1">
                {msg.time} {msg.type === "out" && <span className="text-[#53BDEB]">✓✓</span>}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-2">
            <div className="wa-bubble-in rounded-tr-xl rounded-br-xl rounded-bl-xl px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-[#25D366] typing-dot" />
                <div className="w-2 h-2 rounded-full bg-[#25D366] typing-dot" />
                <div className="w-2 h-2 rounded-full bg-[#25D366] typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Commands */}
      <div className="bg-white border-t border-gray-100 px-4 pt-2 pb-1 flex-shrink-0">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Commands</div>
        <div className="flex gap-2 overflow-x-auto hide-scroll pb-1">
          {QUICK_COMMANDS.map((c) => (
            <button
              key={c.cmd}
              onClick={() => sendMessage(c.cmd)}
              className="flex-shrink-0 bg-gray-50 border-[1.5px] border-gray-200 rounded-full px-3 py-1.5 text-[12px] font-semibold text-gray-700 whitespace-nowrap active:bg-green-50 active:border-green-300 transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="bg-[#F0F2F5] px-3 py-2.5 flex items-center gap-2 flex-shrink-0">
        <button className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-xl shadow-sm flex-shrink-0">🎙️</button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder="Message DOVIC AI..."
          className="flex-1 bg-white rounded-3xl px-4 py-2.5 text-[14px] text-gray-900 outline-none shadow-sm"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center shadow-md flex-shrink-0 active:scale-90 transition-transform disabled:opacity-50"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  );
}
