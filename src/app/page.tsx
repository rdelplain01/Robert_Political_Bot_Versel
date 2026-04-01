"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Settings, User, Bot, RotateCcw, Play, Edit3, Mic,
  History, X, ChevronDown, ChevronUp, ChevronRight, ArrowRight,
  Search, Trash2, Save, Square, Loader2, Download,
} from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import RadarChart from "@/components/RadarChart";

const ELEVENLABS_AGENT_ID = "agent_3801kn02hhrzes788n7vqbp018xs";

type ModeType = "Left" | "Lean-Left" | "Center" | "Lean-Right" | "Right";

type ParamState = {
  enabled: boolean;
  value: number;
  isEditing: boolean;
  editedText: string | null;
  loadedText: string;
};

type ConversationRecord = {
  id: number;
  title: string;
  started_at: string;
  ended_at: string | null;
  user_name: string;
  prompt_snapshot: Record<string, unknown> | null;
};

const modes: ModeType[] = ["Left", "Lean-Left", "Center", "Lean-Right", "Right"];
const modeColors: Record<ModeType, string> = {
  Left: "#3b82f6",
  "Lean-Left": "#60a5fa",
  Center: "#a78bfa",
  "Lean-Right": "#f87171",
  Right: "#ef4444",
};

const paramConfigs = [
  { key: "participation", name: "Participation", emoji: "🗣️" },
  { key: "expression", name: "Expression", emoji: "💬" },
  { key: "reason", name: "Reason-Giving", emoji: "🧠" },
  { key: "listening", name: "Listening", emoji: "👂" },
  { key: "selfint", name: "Self-Interrogation", emoji: "🔍" },
  { key: "disagreement", name: "Disagreement", emoji: "⚔️" },
  { key: "abrasiveness", name: "Abrasiveness", emoji: "🔥" },
  { key: "persuadability", name: "Persuadability", emoji: "🎯" },
];

const sliderLevels: Record<string, string[]> = {
  participation:  ["No Participation", "Low", "Moderate", "High", "Very High Participation"],
  expression:     ["No Expression", "Low", "Moderate", "High", "Very High Expression"],
  reason:         ["No Reasoning", "Low", "Moderate", "High", "Very High Reasoning"],
  listening:      ["No Listening", "Low", "Moderate", "High", "Very High Listening"],
  selfint:        ["No Self-Interrogation", "Low", "Moderate", "High", "Very High Self-Interrogation"],
  disagreement:   ["No Disagreement", "Low", "Moderate", "High", "Very High Disagreement"],
  abrasiveness:   ["Not Abrasive", "Slightly", "Moderate", "High", "Very Abrasive"],
  persuadability: ["Not Persuadable", "Slightly", "Moderate", "High", "Very Persuadable"],
};

export default function Home() {
  // Session states
  const [mode, setMode] = useState<ModeType>("Right");
  const [beliefsText, setBeliefsText] = useState("");
  const [editBeliefs, setEditBeliefs] = useState(false);
  const [editedBeliefs, setEditedBeliefs] = useState<string | null>(null);

  // Custom parameters
  const [customParams, setCustomParams] = useState<{ key: string; name: string }[]>([]);

  // Parameters
  const [params, setParams] = useState<Record<string, ParamState>>(() => {
    const initial: Record<string, ParamState> = {};
    paramConfigs.forEach((p) => {
      initial[p.key] = { enabled: true, value: 3, isEditing: false, editedText: null, loadedText: "" };
    });
    return initial;
  });

  // Prompt / Chat
  const [expressionTemplate, setExpressionTemplate] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  const [messages, setMessages] = useState<{ role: string; content: string; time?: Date }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Database / user
  const [username, setUsername] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [reviewConversationId, setReviewConversationId] = useState<number | null>(null);
  const preReviewParamsRef = useRef<Record<string, ParamState> | null>(null);
  const preReviewCustomParamsRef = useRef<{ key: string; name: string }[] | null>(null);
  const [chatHistory, setChatHistory] = useState<ConversationRecord[]>([]);
  const [savingCount, setSavingCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // UI
  const [paramsCollapsed, setParamsCollapsed] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const onboardingDone = onboardingStep >= 1;
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredConvoId, setHoveredConvoId] = useState<number | null>(null);

  // Refs
  const messagesRef = useRef(messages);
  const generatedPromptRef = useRef(generatedPrompt);
  const conversationIdRef = useRef(conversationId);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { generatedPromptRef.current = editedPrompt ?? generatedPrompt; }, [generatedPrompt, editedPrompt]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // ─── ElevenLabs ───
  const conversation = useConversation({
    onConnect: () => setSessionReady(true),
    onDisconnect: () => { setVoiceMode(false); setSessionReady(false); },
    onMessage: (msg: { source: string; message: string }) => {
      const role = msg.source === "ai" ? "assistant" : "user";
      const content = msg.message || "";
      if (content.trim()) {
        setMessages((prev) => [...prev, { role, content, time: new Date() }]);
        const cId = conversationIdRef.current;
        if (cId) {
          fetch(`/api/conversations/${cId}/messages`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role, content }),
          }).catch(console.error);
        }
      }
    },
    onError: (error: Error | string | unknown) => {
      console.error("ElevenLabs Error:", error);
      alert("Conversation error: " + (error instanceof Error ? error.message : String(error)));
      setVoiceMode(false);
    },
  });

  // ─── Data fetching ───
  useEffect(() => {
    fetch(`/api/content?type=belief&value=${mode}`)
      .then((r) => r.json()).then((d) => setBeliefsText(d.content || ""))
      .catch(console.error);
  }, [mode]);

  useEffect(() => {
    fetch(`/api/content?type=template`)
      .then((r) => r.json()).then((d) => setExpressionTemplate(d.content || ""))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const fetchPrompts = async () => {
      const updated = { ...params };
      let changed = false;
      for (const p of paramConfigs) {
        const s = updated[p.key];
        const res = await fetch(`/api/content?type=slider&name=${p.name}&value=${s.value}`);
        const d = await res.json();
        if (d.content && d.content !== s.loadedText) { s.loadedText = d.content; changed = true; }
      }
      if (changed) setParams(updated);
    };
    fetchPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.participation.value, params.expression.value, params.reason.value,
    params.listening.value, params.selfint.value, params.disagreement.value,
    params.abrasiveness.value, params.persuadability.value,
  ]);

  // ─── Prompt generation ───
  useEffect(() => {
    let fullPrompt = expressionTemplate.replace("{beliefs}", editedBeliefs ?? beliefsText);
    const reps: Record<string, string> = {
      "{participation}": params.participation.enabled ? `Participation: ${params.participation.editedText ?? params.participation.loadedText}\n` : "",
      "{expression}": params.expression.enabled ? `Expression: ${params.expression.editedText ?? params.expression.loadedText}\n` : "",
      "{reason_giving}": params.reason.enabled ? `Reason-Giving: ${params.reason.editedText ?? params.reason.loadedText}\n` : "",
      "{listening}": params.listening.enabled ? `Listening: ${params.listening.editedText ?? params.listening.loadedText}\n` : "",
      "{self_interrogation}": params.selfint.enabled ? `Self-Interrogation: ${params.selfint.editedText ?? params.selfint.loadedText}\n` : "",
      "{disagreement}": params.disagreement.enabled ? `Disagreement: ${params.disagreement.editedText ?? params.disagreement.loadedText}\n` : "",
      "{abrasiveness}": params.abrasiveness.enabled ? `Abrasiveness: ${params.abrasiveness.editedText ?? params.abrasiveness.loadedText}\n` : "",
      "{persuadability}": params.persuadability.enabled ? `Persuadability: ${params.persuadability.editedText ?? params.persuadability.loadedText}\n` : "",
    };
    for (const [k, v] of Object.entries(reps)) fullPrompt = fullPrompt.replace(k, v);

    // Append custom parameters
    const customLines = customParams
      .filter((cp) => params[cp.key]?.enabled && params[cp.key]?.editedText?.trim())
      .map((cp) => `${cp.name}: ${params[cp.key].editedText!.trim()}`)
      .join("\n");
    if (customLines) fullPrompt += "\n" + customLines + "\n";

    setGeneratedPrompt(fullPrompt);
  }, [params, expressionTemplate, beliefsText, editedBeliefs, customParams]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ─── Chat history ───
  const fetchChatHistory = useCallback(async (user: string) => {
    if (!user.trim()) { setChatHistory([]); return; }
    try {
      const res = await fetch(`/api/conversations?user=${encodeURIComponent(user.trim())}`);
      const data = await res.json();
      setChatHistory(data.conversations || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { if (onboardingDone) fetchChatHistory(username); }, [username, onboardingDone, fetchChatHistory]);

  // ─── Helpers ───
  const updateParam = (key: string, updates: Partial<ParamState>) => {
    setParams((prev) => ({ ...prev, [key]: { ...prev[key], ...updates } }));
  };

  const addCustomParam = () => {
    const key = `custom_${Date.now()}`;
    const name = `Custom ${customParams.length + 1}`;
    setCustomParams((prev) => [...prev, { key, name }]);
    setParams((prev) => ({ ...prev, [key]: { enabled: true, value: 3, isEditing: true, editedText: "", loadedText: "" } }));
  };

  const removeCustomParam = (key: string) => {
    setCustomParams((prev) => prev.filter((p) => p.key !== key));
    setParams((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  const renameCustomParam = (key: string, name: string) => {
    setCustomParams((prev) => prev.map((p) => p.key === key ? { ...p, name } : p));
  };

  const buildPromptSnapshot = () => {
    const snap: Record<string, unknown> = {};
    for (const p of paramConfigs) {
      const s = params[p.key];
      if (!s.enabled) snap[p.name] = "DISABLED";
      else if (s.editedText && s.editedText.trim() !== s.loadedText.trim()) snap[p.name] = s.editedText.trim();
      else snap[p.name] = s.value;
    }
    for (const cp of customParams) {
      const s = params[cp.key];
      if (!s) continue;
      if (!s.enabled) snap[cp.name] = "DISABLED";
      else if (s.editedText?.trim()) snap[cp.name] = s.editedText.trim();
    }
    return snap;
  };

  const endCurrentConversation = async (trigger: string) => {
    if (!conversationId) return;
    try {
      // Generate AI title from conversation
      let title: string | undefined;
      if (messagesRef.current.length > 0) {
        try {
          const titleRes = await fetch("/api/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
            }),
          });
          const titleData = await titleRes.json();
          if (titleData.title && titleData.title !== "New chat") {
            title = titleData.title;
          }
        } catch { /* fall back to server-derived title */ }
      }

      await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger, title }),
      });
    } catch (err) { console.error(err); }
    setConversationId(null);
  };

  const handleSaveChat = async () => {
    if (!conversationId) return;
    const savingId = conversationId;
    const savingMessages = [...messagesRef.current];
    // Reset UI immediately so the user isn't waiting
    setConversationId(null);
    setSessionReady(false); setVoiceMode(false); setMessages([]);
    setReviewConversationId(null);
    if (conversation.status === "connected" || conversation.status === "connecting") {
      conversation.endSession().catch(console.error);
    }
    // Save in the background (title generation + PATCH)
    setSavingCount((c) => c + 1);
    (async () => {
      try {
        let title: string | undefined;
        if (savingMessages.length > 0) {
          try {
            const titleRes = await fetch("/api/title", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: savingMessages.map((m) => ({ role: m.role, content: m.content })),
              }),
            });
            const titleData = await titleRes.json();
            if (titleData.title && titleData.title !== "New chat") {
              title = titleData.title;
            }
          } catch { /* fall back to server-derived title */ }
        }
        await fetch(`/api/conversations/${savingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "manual_save", title }),
        });
      } catch (err) { console.error(err); }
      setSavingCount((c) => c - 1);
      fetchChatHistory(username);
    })();
  };

  const handleExitWithoutSaving = async () => {
    if (!conversationId) return;
    try {
      await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    } catch (err) { console.error(err); }
    
    setConversationId(null);
    setSessionReady(false); setVoiceMode(false); setMessages([]);
    setReviewConversationId(null);
    if (conversation.status === "connected" || conversation.status === "connecting") {
      await conversation.endSession().catch(console.error);
    }
    fetchChatHistory(username);
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    await endCurrentConversation("reset");
    setMode("Right"); setEditBeliefs(false); setEditedBeliefs(null);
    setSessionReady(false); setVoiceMode(false); setMessages([]);
    setReviewConversationId(null); setEditedPrompt(null); setShowFullPrompt(false); setCustomParams([]);
    setParams((prev) => {
      const reset: Record<string, ParamState> = {};
      for (const key of Object.keys(prev)) {
        reset[key] = { ...prev[key], value: 3, editedText: null, isEditing: false };
      }
      return reset;
    });
    if (conversation.status === "connected" || conversation.status === "connecting") {
      await conversation.endSession().catch(console.error);
    }
    const initial: Record<string, ParamState> = {};
    paramConfigs.forEach((p) => {
      initial[p.key] = { enabled: true, value: 3, isEditing: false, editedText: null, loadedText: "" };
    });
    setParams(initial);
    fetchChatHistory(username);
  };

  const handlePlay = async (isVoice: boolean) => {
    if (!username.trim()) { alert("Please enter a username before starting a chat."); return; }
    await endCurrentConversation("play_new_chat");
    setReviewConversationId(null);

    const snap = buildPromptSnapshot();
    try {
      const res = await fetch("/api/conversations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: username.trim(), promptSnapshot: snap }),
      });
      const data = await res.json();
      if (data.id) {
        setConversationId(data.id);
        await fetch(`/api/conversations/${data.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: "Hello." }),
        });
      }
    } catch (err) { console.error(err); }

    setVoiceMode(isVoice);
    if (isVoice) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await conversation.startSession({
          agentId: ELEVENLABS_AGENT_ID, connectionType: "websocket",
          clientTools: {}, dynamicVariables: { full_prompt: generatedPromptRef.current },
        });
      } catch (err) {
        console.error(err); alert("Failed to start voice mode."); setVoiceMode(false);
      }
    } else {
      setSessionReady(true);
      setMessages([{ role: "assistant", content: "Hello.", time: new Date() }]);
    }
  };

  // Auto-resize textarea
  const autoResize = () => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
  };

  const handleSendMessage = async (rawText?: string) => {
    const text = rawText || chatInput;
    if (!text.trim()) return;

    const userMsg = { role: "user", content: text, time: new Date() };
    const cur = messagesRef.current;
    const next = [...cur, userMsg];
    setMessages(next);
    if (!rawText) {
      setChatInput("");
      if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
    }
    setIsTyping(true);

    const cId = conversationIdRef.current;
    if (cId) {
      fetch(`/api/conversations/${cId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: text }),
      }).catch(console.error);
    }

    try {
      const fullHistory = [{ role: "system", content: generatedPromptRef.current }, ...next];
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullHistory }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, { ...data.message, time: new Date() }]);
        if (cId) {
          fetch(`/api/conversations/${cId}/messages`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "assistant", content: data.message.content }),
          }).catch(console.error);
        }
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I ran into an error." }]);
      }
    } catch { setMessages((prev) => [...prev, { role: "assistant", content: "Network error." }]); }
    finally { setIsTyping(false); }
  };

  const handleStopVoice = async () => {
    setVoiceMode(false);
    if (conversation.status === "connected" || conversation.status === "connecting") {
      await conversation.endSession().catch(console.error);
    }
  };

  const handleLoadConversation = async (convoId: number) => {
    await endCurrentConversation("history_open");
    setSessionReady(false); setVoiceMode(false);
    try {
      const res = await fetch(`/api/conversations/${convoId}`);
      const data = await res.json();
      setMessages((data.messages || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })));
      setReviewConversationId(convoId);
      setConversationId(null);
      setSidebarOpen(false);

      // Save original params only on first review entry (not when switching between history items)
      if (!preReviewParamsRef.current) {
        preReviewParamsRef.current = { ...params };
        preReviewCustomParamsRef.current = [...customParams];
      }

      // Apply prompt snapshot to parameters
      const convo = chatHistory.find((c) => c.id === convoId);
      if (convo?.prompt_snapshot) {
        const snap = convo.prompt_snapshot;
        const builtInNames = new Set(paramConfigs.map((p) => p.name));
        const restoredCustom: { key: string; name: string }[] = [];

        // Start from the original pre-review params to avoid accumulating old custom keys
        setParams(() => {
          const base = preReviewParamsRef.current!;
          const updated: Record<string, ParamState> = {};
          // Only carry over built-in param keys
          for (const p of paramConfigs) {
            updated[p.key] = { ...base[p.key] };
          }
          for (const p of paramConfigs) {
            const val = snap[p.name];
            if (val === undefined) continue;
            if (val === "DISABLED") {
              updated[p.key] = { ...updated[p.key], enabled: false, isEditing: false };
            } else if (typeof val === "number") {
              updated[p.key] = { ...updated[p.key], enabled: true, value: val, editedText: null, isEditing: false };
            } else if (typeof val === "string") {
              updated[p.key] = { ...updated[p.key], enabled: true, editedText: val, isEditing: true };
            }
          }
          // Restore custom params from snapshot
          for (const [name, val] of Object.entries(snap)) {
            if (builtInNames.has(name)) continue;
            const key = `custom_${Date.now()}_${restoredCustom.length}`;
            restoredCustom.push({ key, name });
            if (val === "DISABLED") {
              updated[key] = { enabled: false, value: 3, isEditing: false, editedText: null, loadedText: "" };
            } else if (typeof val === "string") {
              updated[key] = { enabled: true, value: 3, isEditing: true, editedText: val, loadedText: "" };
            }
          }
          return updated;
        });
        setCustomParams(restoredCustom);
      } else {
        setCustomParams([]);
      }
    } catch (err) { console.error(err); }
  };

  const isReviewMode = reviewConversationId !== null;

  // Radar chart data
  const radarData = paramConfigs.map((p) => ({
    label: p.name,
    value: params[p.key].enabled ? params[p.key].value : 0,
  }));

  // ─── Delete conversation ───
  const handleDeleteConversation = async (convoId: number) => {
    try {
      await fetch(`/api/conversations/${convoId}`, { method: "DELETE" });
      setChatHistory((prev) => prev.filter((c) => c.id !== convoId));
      if (reviewConversationId === convoId) {
        setReviewConversationId(null);
        setMessages([]);
      }
    } catch (err) { console.error(err); }
  };

  // ─── Download conversation as text file ───
  const handleDownloadChat = async (convoId: number, title?: string) => {
    try {
      const res = await fetch(`/api/conversations/${convoId}`);
      const data = await res.json();
      const msgs: { role: string; content: string; created_at?: string }[] = data.messages || [];
      const lines = msgs.map((m) => {
        const speaker = m.role === "user" ? "You" : "Robert";
        return `${speaker}: ${m.content}`;
      });
      const text = lines.join("\n\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "conversation").replace(/[^a-z0-9]/gi, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  // ─── Date grouping ───
  const groupByDate = (convos: ConversationRecord[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const groups: { label: string; items: ConversationRecord[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Older", items: [] },
    ];
    for (const c of convos) {
      const d = new Date(c.started_at);
      if (d >= today) groups[0].items.push(c);
      else if (d >= yesterday) groups[1].items.push(c);
      else groups[2].items.push(c);
    }
    return groups.filter((g) => g.items.length > 0);
  };

  const filteredHistory = searchQuery.trim()
    ? chatHistory.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chatHistory;
  const groupedHistory = groupByDate(filteredHistory);

  // ─────────────────────────── RENDER ───────────────────────────

  // ─── Onboarding Wizard ───
  if (!onboardingDone) {
    return (
      <div className="min-h-screen text-slate-100 font-[family-name:var(--font-inter)] flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="step-enter glass-card p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Bot size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Welcome to SAIL Lab</h1>
              <p className="text-sm text-slate-400">Build democratic conversation skills by chatting with an AI whose personality you design.</p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none text-center"
                onKeyDown={(e) => { if (e.key === "Enter" && username.trim()) setOnboardingStep(1); }}
                autoFocus
              />
              <button
                onClick={() => setOnboardingStep(1)}
                disabled={!username.trim()}
                className="glow-btn w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Get Started <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 font-[family-name:var(--font-inter)]">
      {/* ─── Reset Confirmation Modal ─── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sidebar-backdrop">
          <div className="glass-card p-6 max-w-sm mx-4 space-y-4">
            <h3 className="text-lg font-bold text-white">Reset everything?</h3>
            <p className="text-sm text-slate-400">This will end your current conversation and reset all settings to defaults.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition">Cancel</button>
              <button onClick={handleReset} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Desktop Sidebar (always visible) ─── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-72 z-30 bg-[#0c1222]/95 backdrop-blur-xl border-r border-indigo-500/10 flex-col">
        <div className="p-4 border-b border-indigo-500/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Bot size={18} />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white leading-tight">SAIL Lab</h1>
              <p className="text-[10px] text-slate-500">Democratic Skills Builder</p>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats…"
              className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500/40 focus:outline-none transition"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
          {!username.trim() ? (
            <p className="text-xs text-slate-500 italic p-2">Enter a username to see history.</p>
          ) : groupedHistory.length === 0 && savingCount === 0 ? (
            <p className="text-xs text-slate-500 italic p-2">{searchQuery ? "No matches." : "No saved chats yet."}</p>
          ) : (
            <>
            {Array.from({ length: savingCount }).map((_, i) => (
              <div key={`saving-${i}`} className="rounded-lg text-xs border border-indigo-500/20 bg-indigo-500/5 animate-pulse">
                <div className="p-2.5 flex items-center gap-2">
                  <Loader2 size={13} className="text-indigo-400 animate-spin" />
                  <span className="font-medium text-indigo-300">Saving...</span>
                </div>
              </div>
            ))}
            {groupedHistory.map((group) => (
              <div key={group.label}>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">{group.label}</h3>
                <div className="space-y-0.5">
                  {group.items.map((convo) => (
                    <div
                      key={convo.id}
                      className={`group/item relative rounded-lg text-xs transition-all cursor-pointer ${
                        reviewConversationId === convo.id
                          ? "bg-indigo-500/15 border border-indigo-500/25"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                      onMouseEnter={() => setHoveredConvoId(convo.id)}
                      onMouseLeave={() => setHoveredConvoId(null)}
                    >
                      <button
                        onClick={() => handleLoadConversation(convo.id)}
                        className="w-full text-left p-2.5"
                      >
                        <div className="font-medium text-slate-200 truncate pr-6">{convo.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{new Date(convo.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover/item:opacity-100 transition">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadChat(convo.id, convo.title); }}
                          className="p-1 rounded hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-400 transition"
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteConversation(convo.id); }}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {/* Prompt snapshot tooltip */}
                      {hoveredConvoId === convo.id && convo.prompt_snapshot && (
                        <div className="absolute left-full top-0 ml-2 z-50 w-48 p-2.5 glass-card text-[10px] space-y-0.5 pointer-events-none">
                          <div className="font-bold text-slate-300 mb-1">Prompt Snapshot</div>
                          {Object.entries(convo.prompt_snapshot).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-slate-400">{k}:</span>
                              <span className="text-indigo-300 font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            </>
          )}
        </div>
      </aside>

      {/* ─── Mobile Sidebar (slide-out) ─── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-72 bg-[#0c1222]/98 backdrop-blur-xl border-r border-indigo-500/10 flex flex-col h-full z-50">
            <div className="p-4 border-b border-indigo-500/10 flex items-center justify-between">
              <h2 className="font-bold text-sm text-white flex items-center gap-2">
                <History size={16} className="text-indigo-400" /> History
              </h2>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500/40 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
              {Array.from({ length: savingCount }).map((_, i) => (
                <div key={`saving-mobile-${i}`} className="rounded-lg text-xs border border-indigo-500/20 bg-indigo-500/5 animate-pulse">
                  <div className="p-2.5 flex items-center gap-2">
                    <Loader2 size={13} className="text-indigo-400 animate-spin" />
                    <span className="font-medium text-indigo-300">Saving...</span>
                  </div>
                </div>
              ))}
              {filteredHistory.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => { handleLoadConversation(convo.id); setSidebarOpen(false); }}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition ${
                    reviewConversationId === convo.id ? "bg-indigo-500/15" : "hover:bg-white/5"
                  }`}
                >
                  <div className="font-medium text-slate-200 truncate">{convo.title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{new Date(convo.started_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-20 border-b border-indigo-500/10 bg-[#0b1120]/80 backdrop-blur-xl lg:ml-72">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-indigo-400 transition lg:hidden"
            >
              <History size={20} />
            </button>
            <div className="lg:hidden w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Bot size={18} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm w-36 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:outline-none text-white placeholder-slate-500 transition"
            />
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm transition border border-white/10"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="lg:ml-72 max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ─── Left Column: Settings (hidden on mobile unless panel open) ─── */}
        <div className="hidden lg:block lg:col-span-7 space-y-5">
          {/* Mode Selection */}
          <div className={`glass-card p-5 ${editedPrompt !== null ? "opacity-40 pointer-events-none" : ""}`}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-slate-300">
              <Settings className="text-indigo-400" size={16} /> Mode Selection
            </h2>
            <div className="mb-4">
              <div className="flex justify-between text-xs font-medium text-slate-500 mb-2 px-0.5">
                {modes.map((val) => (
                  <span
                    key={val}
                    className="transition-colors"
                    style={mode === val ? { color: modeColors[val], fontWeight: 700 } : {}}
                  >
                    {val}
                  </span>
                ))}
              </div>
              <input
                type="range" min="0" max="4"
                value={modes.indexOf(mode)}
                onChange={(e) => setMode(modes[parseInt(e.target.value)])}
                className="w-full cursor-pointer"
              />
            </div>
            <button
              onClick={() => setEditBeliefs(!editBeliefs)}
              className="px-3 py-1.5 border border-white/10 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-white/5 text-slate-400 hover:text-white transition"
            >
              <Edit3 size={13} /> Edit Beliefs
            </button>
            {editBeliefs && (
              <textarea
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                value={editedBeliefs ?? beliefsText}
                onChange={(e) => { setEditedBeliefs(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                className="w-full mt-3 p-3 bg-white/5 border border-white/10 rounded-lg text-sm min-h-[60px] focus:ring-2 focus:ring-indigo-500/50 focus:outline-none text-slate-300 resize-none overflow-y-auto custom-scrollbar"
              />
            )}
          </div>

          {/* Conversation Parameters */}
          <div className={`glass-card p-5 ${editedPrompt !== null ? "opacity-40 pointer-events-none" : ""}`}>
            <button
              onClick={() => setParamsCollapsed(!paramsCollapsed)}
              className="w-full text-sm font-semibold flex items-center justify-between text-slate-300 group"
            >
              <span className="flex items-center gap-2">
                <Settings className="text-indigo-400" size={16} /> Conversation Parameters
              </span>
              {paramsCollapsed ? <ChevronDown size={16} className="text-slate-500 group-hover:text-slate-300 transition" /> : <ChevronUp size={16} className="text-slate-500 group-hover:text-slate-300 transition" />}
            </button>

            {!paramsCollapsed && (
              <div className="mt-4 space-y-3">
                {paramConfigs.map((p) => {
                  const state = params[p.key];
                  return (
                    <div
                      key={p.key}
                      className={`p-3 rounded-xl border transition-all ${
                        state.enabled
                          ? "border-white/5 bg-white/[0.02] hover:border-indigo-500/20"
                          : "border-transparent bg-white/[0.01] opacity-40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateParam(p.key, { enabled: !state.enabled })}
                          className={`toggle-track shrink-0 ${state.enabled ? "active" : ""}`}
                        >
                          <div className="toggle-thumb" />
                        </button>
                        <span className="text-xs font-medium text-slate-300 w-[130px] shrink-0 flex items-center gap-1.5">
                          <span>{p.emoji}</span> {p.name}
                        </span>
                        <div className="group/slider flex-1 min-w-0 flex flex-col">
                          <input
                            type="range" min="1" max="5"
                            value={state.value}
                            disabled={!state.enabled}
                            onChange={(e) => updateParam(p.key, { value: parseInt(e.target.value), editedText: null })}
                            className="w-full cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-500 mt-0.5 text-center opacity-0 group-hover/slider:opacity-100 transition-opacity duration-200">
                            {sliderLevels[p.key]?.[state.value - 1] ?? ""}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-indigo-400 w-4 text-center">{state.value}</span>
                        <button
                          onClick={() => updateParam(p.key, { isEditing: !state.isEditing })}
                          disabled={!state.enabled}
                          className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-slate-500 hover:text-indigo-400 transition"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                      {state.isEditing && state.enabled && (
                        <textarea
                          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                          value={state.editedText ?? state.loadedText}
                          onChange={(e) => { updateParam(p.key, { editedText: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                          className="w-full mt-3 p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs min-h-[50px] focus:ring-2 focus:ring-indigo-500/50 focus:outline-none text-slate-300 resize-none overflow-y-auto custom-scrollbar"
                        />
                      )}
                    </div>
                  );
                })}

                {/* Custom Parameters */}
                {customParams.map((cp) => {
                  const state = params[cp.key];
                  if (!state) return null;
                  return (
                    <div
                      key={cp.key}
                      className={`p-3 rounded-xl border transition-all ${
                        state.enabled
                          ? "border-indigo-500/20 bg-indigo-500/[0.03] hover:border-indigo-500/30"
                          : "border-transparent bg-white/[0.01] opacity-40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateParam(cp.key, { enabled: !state.enabled })}
                          className={`toggle-track shrink-0 ${state.enabled ? "active" : ""}`}
                        >
                          <div className="toggle-thumb" />
                        </button>
                        <input
                          type="text"
                          value={cp.name}
                          onChange={(e) => renameCustomParam(cp.key, e.target.value)}
                          className="text-xs font-medium text-slate-300 bg-transparent border-b border-white/10 focus:border-indigo-500/50 focus:outline-none flex-1 min-w-0 py-0.5"
                          placeholder="Parameter name"
                        />
                        <button
                          onClick={() => removeCustomParam(cp.key)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition"
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {state.enabled && (
                        <textarea
                          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                          value={state.editedText ?? ""}
                          onChange={(e) => { updateParam(cp.key, { editedText: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                          placeholder="Describe this parameter's behavior..."
                          className="w-full mt-3 p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs min-h-[50px] focus:ring-2 focus:ring-indigo-500/50 focus:outline-none text-slate-300 resize-none overflow-y-auto custom-scrollbar"
                        />
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={addCustomParam}
                  className="w-full py-2.5 rounded-xl border border-dashed border-white/10 hover:border-indigo-500/30 text-xs font-medium text-slate-500 hover:text-indigo-400 transition flex items-center justify-center gap-1.5"
                >
                  + Add Custom Parameter
                </button>
              </div>
            )}
          </div>

          {/* Edit Full Prompt */}
          <div className="glass-card p-4">
            <button
              onClick={() => setShowFullPrompt(!showFullPrompt)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition"
            >
              <span className="flex items-center gap-2">
                <Edit3 size={14} className="text-indigo-400" />
                {editedPrompt !== null ? "Full Prompt (edited)" : "Full Prompt"}
              </span>
              {showFullPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showFullPrompt && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={editedPrompt ?? generatedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="w-full p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs min-h-[200px] focus:ring-2 focus:ring-indigo-500/50 focus:outline-none text-slate-300 resize-y overflow-y-auto custom-scrollbar font-mono"
                />
                {editedPrompt !== null && (
                  <button
                    onClick={() => setEditedPrompt(null)}
                    className="text-[10px] text-amber-400 hover:text-amber-300 transition"
                  >
                    Reset to auto-generated
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Play Buttons */}
          <div className="glass-card p-5">
            {!sessionReady && !isReviewMode ? (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={() => handlePlay(false)}
                    disabled={!username.trim()}
                    className="glow-btn flex-1 py-3.5 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                  >
                    <Play size={18} fill="currentColor" /> Play with Chat
                  </button>
                  <button
                    onClick={() => handlePlay(true)}
                    disabled={!username.trim()}
                    className="glow-btn flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Mic size={18} /> Play with Voice
                  </button>
                </div>
                {!username.trim() && (
                  <p className="text-[11px] text-slate-500 mt-2.5 text-center">Enter a username above to start chatting.</p>
                )}
              </>
            ) : isReviewMode ? (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col gap-2.5 text-sm">
                <span className="flex items-center gap-2 text-amber-400 font-semibold">
                  <History size={16} /> Viewing Past Chat
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (preReviewParamsRef.current) setParams(preReviewParamsRef.current);
                      setCustomParams(preReviewCustomParamsRef.current ?? []);
                      preReviewParamsRef.current = null;
                      preReviewCustomParamsRef.current = null;
                      setReviewConversationId(null); setMessages([]); setSessionReady(false);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold border border-indigo-500/30 transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight size={13} /> Back to Chat
                  </button>
                  <button
                    onClick={() => {
                      preReviewParamsRef.current = null;
                      preReviewCustomParamsRef.current = null;
                      setReviewConversationId(null); setMessages([]); setSessionReady(false);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white text-xs font-bold border border-amber-500/30 transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight size={13} /> Keep Parameters
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleSaveChat}
                  className="glow-btn flex-1 py-3.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 text-sm border border-white/5"
                >
                  <Square size={18} fill="currentColor" /> Stop Chat
                </button>
                <button
                  onClick={handleExitWithoutSaving}
                  className="glow-btn flex-1 py-3.5 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2.5 text-sm border border-white/5"
                >
                  <Trash2 size={18} /> Discard
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right Column: Radar + Chat (full width on mobile) ─── */}
        <div className="lg:col-span-5 flex flex-col gap-5 h-[calc(100vh-6rem)] lg:sticky lg:top-20">
          {/* Radar Chart */}
          <div className="hidden lg:flex glass-card p-4 items-center justify-center shrink-0">
            <RadarChart data={radarData} size={200} />
          </div>

          {/* Chat Panel */}
          <div className="flex-1 glass-card flex flex-col overflow-hidden min-h-0">
            {/* Chat header */}
            <div className={`px-4 py-3 flex items-center justify-between border-b border-white/5 ${
              isReviewMode ? "bg-amber-500/5" : voiceMode ? "bg-indigo-500/5" : "bg-white/[0.02]"
            }`}>
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Bot size={16} className="text-indigo-400" />
                Robert
                {voiceMode && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold">🎙 VOICE</span>}
                {isReviewMode && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">📖 REVIEW</span>}
              </span>
              {isReviewMode && reviewConversationId && (
                <button
                  onClick={() => handleDownloadChat(reviewConversationId, chatHistory.find(c => c.id === reviewConversationId)?.title)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-indigo-300 transition"
                  title="Download conversation"
                >
                  <Download size={15} />
                </button>
              )}
              {sessionReady && <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"></span>}
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
              {!sessionReady && !isReviewMode ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center text-sm space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-2">
                    <Bot size={24} className="text-indigo-400" />
                  </div>
                  <p>Press <span className="text-indigo-400 font-medium">&quot;Play&quot;</span> to begin talking with Robert. Press <span className="text-rose-400 font-medium">&quot;Stop&quot;</span> to save.</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                  Say hello down below!
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className={`message-enter msg-wrapper flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                      m.role === "user"
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-white/5 text-slate-400"
                    }`}>
                      {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className="flex flex-col gap-0.5 max-w-[80%]">
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-indigo-600/80 text-white rounded-tr-md"
                            : "bg-white/5 border border-white/5 text-slate-300 rounded-tl-md markdown-style"
                        }`}
                      >
                        {m.content}
                      </div>
                      {m.time && (
                        <span className={`msg-time text-[10px] text-slate-600 px-1 ${m.role === "user" ? "text-right" : "text-left"}`}>
                          {m.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isTyping && (
                <div className="message-enter flex gap-2.5">
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                    <Bot size={14} />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 rounded-tl-md flex gap-1.5 items-center">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-white/5 bg-white/[0.01]">
              {isReviewMode ? (
                <p className="text-xs text-slate-500 text-center py-2 italic">Read-only review of a past conversation.</p>
              ) : voiceMode ? (
                <div className="flex items-center justify-center py-2">
                    {conversation.status === "connecting" ? (
                      <span className="text-slate-400 text-sm animate-pulse">Connecting…</span>
                    ) : conversation.status === "connected" ? (
                      conversation.isSpeaking ? (
                        <span className="text-indigo-400 text-sm animate-pulse flex items-center gap-1.5"><Bot size={14} /> Speaking…</span>
                      ) : (
                        <span className="text-red-400 text-sm font-bold animate-pulse flex items-center gap-1.5"><Mic size={14} /> Listening…</span>
                      )
                    ) : (
                      <span className="text-slate-500 text-sm">Disconnected</span>
                    )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-end">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    disabled={!sessionReady || isTyping}
                    value={chatInput}
                    onChange={(e) => { setChatInput(e.target.value); autoResize(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder={sessionReady ? "Type a message… (Shift+Enter for new line)" : "Waiting to start…"}
                    className="w-full pl-4 pr-12 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/30 focus:outline-none text-white placeholder-slate-500 transition disabled:opacity-30 resize-none overflow-hidden"
                    style={{ maxHeight: '120px' }}
                  />
                  <button
                    type="submit"
                    disabled={!sessionReady || !chatInput.trim() || isTyping}
                    className="absolute right-1.5 bottom-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 transition"
                  >
                    <Send size={14} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ─── Mobile Settings FAB + Panel ─── */}
      <button
        className="settings-fab lg:hidden"
        onClick={() => setMobileSettingsOpen(true)}
        title="Settings"
      >
        <Settings size={22} />
      </button>

      {mobileSettingsOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex flex-col">
          <div className="flex-1 sidebar-backdrop" onClick={() => setMobileSettingsOpen(false)} />
          <div className="mobile-settings-panel bg-[#0f172a]/98 backdrop-blur-xl border-t border-indigo-500/10 max-h-[75vh] overflow-y-auto custom-scrollbar p-5 space-y-5 rounded-t-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Settings size={16} className="text-indigo-400" /> Settings</h2>
              <button onClick={() => setMobileSettingsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400"><X size={18} /></button>
            </div>

            {/* Mode Selection (mobile) */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Mode</h3>
              <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1">
                {modes.map((val) => (
                  <span key={val} style={mode === val ? { color: modeColors[val], fontWeight: 700 } : {}}>{val}</span>
                ))}
              </div>
              <input type="range" min="0" max="4" value={modes.indexOf(mode)} onChange={(e) => setMode(modes[parseInt(e.target.value)])} className="w-full cursor-pointer" />
            </div>

            {/* Parameters (mobile) */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 mb-2">Parameters</h3>
              <div className="space-y-2">
                {paramConfigs.map((p) => {
                  const state = params[p.key];
                  return (
                    <div key={p.key} className="flex items-center gap-2">
                      <button
                        onClick={() => updateParam(p.key, { enabled: !state.enabled })}
                        className={`toggle-track shrink-0 ${state.enabled ? "active" : ""}`}
                        style={{ transform: 'scale(0.85)' }}
                      >
                        <div className="toggle-thumb" />
                      </button>
                      <span className="text-[11px] text-slate-300 w-[100px] shrink-0">{p.emoji} {p.name}</span>
                      <input
                        type="range" min="1" max="5" value={state.value} disabled={!state.enabled}
                        onChange={(e) => updateParam(p.key, { value: parseInt(e.target.value), editedText: null })}
                        className="flex-1 min-w-0 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-indigo-400 w-3">{state.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Play buttons (mobile) */}
            <div className="flex gap-3">
              <button
                onClick={() => { setMobileSettingsOpen(false); handlePlay(false); }}
                disabled={!username.trim()}
                className="glow-btn flex-1 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-30 border border-white/5"
              >
                <Play size={16} fill="currentColor" /> Chat
              </button>
              <button
                onClick={() => { setMobileSettingsOpen(false); handlePlay(true); }}
                disabled={!username.trim()}
                className="glow-btn flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-30"
              >
                <Mic size={16} /> Voice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
