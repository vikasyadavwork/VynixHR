import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Cpu,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, json } from "./api";
import type { ChatReply } from "./types";
import { Button, PageTitle } from "./ui";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: ChatReply;
}

const suggestions = [
  {
    title: "A little time to recharge",
    question: "How many days of annual leave do I get?",
    icon: "☀",
  },
  { title: "Make yourself at home", question: "How do I request a work-from-home day?", icon: "⌂" },
  {
    title: "Start on the right foot",
    question: "Which documents are needed for onboarding?",
    icon: "✳",
  },
  { title: "The practical things", question: "When is salary paid?", icon: "↗" },
];

export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
    });
  }, [messages, pending]);

  async function ask(value: string) {
    const text = value.trim();
    if (!text || pending) return;
    setMessages((previous) => [...previous, { id: Date.now(), role: "user", text }]);
    setQuestion("");
    setError("");
    setPending(true);
    try {
      const reply = await api<ChatReply>("/ai/chat", json("POST", { message: text }));
      setMessages((previous) => [
        ...previous,
        { id: Date.now(), role: "assistant", text: reply.answer, reply },
      ]);
    } catch (err) {
      setError((err as Error).message);
      setQuestion(text);
    } finally {
      setPending(false);
      input.current?.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE HELP GOES A LONG WAY"
        title="Hi, I’m Vynix. Ask away."
        description="Clear answers to everyday HR questions, right when you need them."
        actions={
          <Button
            variant="secondary"
            disabled={!messages.length || pending}
            onClick={() => {
              setMessages([]);
              setError("");
              setQuestion("");
            }}
          >
            <Plus size={17} />
            New conversation
          </Button>
        }
      />
      <div className="assistant-layout">
        <section className="chat-panel">
          <div className="chat-topbar">
            <span className="assistant-avatar">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>Vynix assistant</strong>
              <span>
                <i />
                Local FAQ retrieval
              </span>
            </div>
            <span className="ai-label">YOUR HR COMPANION</span>
          </div>
          <div
            className={`chat-messages ${!messages.length ? "chat-empty" : ""}`}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!messages.length && (
              <div className="assistant-welcome">
                <div className="assistant-welcome-icon">
                  <Sparkles size={37} />
                  <span>✦</span>
                </div>
                <span className="eyebrow">LESS SEARCHING. MORE KNOWING.</span>
                <h2>
                  Good questions deserve
                  <br />
                  <em>helpful answers.</em>
                </h2>
                <p>
                  Time off, getting started, work policies, and more.
                  <br />
                  What’s on your mind today?
                </p>
                <div className="suggestion-grid">
                  {suggestions.map((item) => (
                    <button key={item.question} onClick={() => void ask(item.question)}>
                      <span className="suggestion-icon">{item.icon}</span>
                      <strong>{item.title}</strong>
                      <p>{item.question}</p>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={`${message.id}-${message.role}`}
                className={`chat-message message-${message.role}`}
              >
                {message.role === "assistant" && (
                  <span className="message-icon">
                    <Sparkles size={17} />
                  </span>
                )}
                <div className="message-content">
                  <span className="message-author">
                    {message.role === "user" ? "You" : "Vynix assistant"}
                  </span>
                  <p>{message.text}</p>
                  {message.reply?.source && (
                    <div className="source-card">
                      <BookOpen size={16} />
                      <div>
                        <span>{message.reply.source.category} · FAQ source</span>
                        <strong>{message.reply.source.question}</strong>
                      </div>
                      <Check size={15} />
                    </div>
                  )}
                  {message.reply && (
                    <span className="answer-note">
                      {message.reply.matched
                        ? "Retrieved from the local demo handbook"
                        : "No reliable FAQ match found — your HR team can help."}
                    </span>
                  )}
                  {message.reply?.suggestions && message.reply.suggestions.length > 0 && (
                    <div className="followup-questions">
                      {message.reply.suggestions.slice(0, 3).map((suggestion) => (
                        <button
                          disabled={pending}
                          key={suggestion}
                          onClick={() => void ask(suggestion)}
                        >
                          {suggestion}
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pending && (
              <div className="thinking-message" role="status">
                <span className="message-icon">
                  <Sparkles size={17} />
                </span>
                <span>Looking through the local handbook</span>
                <LoaderCircle size={15} className="spin" />
              </div>
            )}
            <div ref={bottom} />
          </div>
          <div className="chat-composer">
            {error && (
              <div className="inline-error" role="alert">
                {error} Your question is below so you can try again.
              </div>
            )}
            <form onSubmit={submit}>
              <textarea
                ref={input}
                value={question}
                maxLength={1000}
                rows={1}
                placeholder="Ask about leave, benefits, onboarding…"
                aria-label="Your HR question"
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void ask(question);
                  }
                }}
              />
              <button aria-label="Send question" disabled={pending || !question.trim()}>
                <Send size={18} />
              </button>
            </form>
            <p>
              <ShieldCheck size={12} />
              Runs locally · Answers use fictional demo policies · Each question is matched
              independently
            </p>
          </div>
        </section>
        <aside className="assistant-sidebar">
          <section className="panel assistant-info">
            <span className="info-icon">
              <BookOpen size={24} />
            </span>
            <h2>
              Your handbook,
              <br />a little more human.
            </h2>
            <p>
              I find answers in a locally trained FAQ model. Each matched answer includes its
              handbook source.
            </p>
            <div>
              <Cpu size={17} />
              <span>
                <strong>Trained on your machine</strong>
                <small>No external AI key or cloud model required.</small>
              </span>
            </div>
            <div>
              <ShieldCheck size={17} />
              <span>
                <strong>Private by design</strong>
                <small>This chat does not send prompts to an external AI provider.</small>
              </span>
            </div>
            <div>
              <MessageCircle size={17} />
              <span>
                <strong>Honest about the gaps</strong>
                <small>If I can’t find a reliable answer, I’ll say so.</small>
              </span>
            </div>
          </section>
          <section className="assistant-note">
            <Sparkles size={18} />
            <h3>A note about this demo</h3>
            <p>
              These sample policies are for exploring the app. They are not your employer’s actual
              policies, and I cannot look up personal payroll or employee records.
            </p>
          </section>
          <p className="assistant-tip">
            Tip: Ask one specific question at a time. A little context helps me find a better match.
          </p>
        </aside>
      </div>
    </>
  );
}
