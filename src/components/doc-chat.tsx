import { tf } from "@/lib/i18n";
// Chat « Demander à Clario » : une conversation par document, enregistrée dans le compte.
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Copy, GraduationCap, MoreHorizontal, Pencil, PenLine, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { currentLocale, useI18n } from "@/lib/i18n";
import { setNotebookClip } from "@/lib/notebook-clipboard";
import { refreshCredits } from "@/hooks/use-credits";

export type ChatSeed = { text: string; image?: string | undefined; nonce: number };

function ChatInner({ documentId, initial, seed, onAddToPage }: { documentId: string; initial: UIMessage[]; seed: ChatSeed | null; onAddToPage?: ((text: string, handwritten: boolean) => void) | undefined }) {
  const { t } = useI18n();
  const [input, setInput] = useState(""); const box = useRef<HTMLTextAreaElement>(null); const used = useRef(0);
  const token = useRef(""); useEffect(() => { void supabase.auth.getSession().then(({ data }) => { token.current = data.session?.access_token ?? ""; }); const { data } = supabase.auth.onAuthStateChange((_e, sess) => { token.current = sess?.access_token ?? ""; }); return () => data.subscription.unsubscribe(); }, []);
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: documentId, messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat", body: () => ({ documentId, locale: currentLocale() }), headers: () => ({ Authorization: `Bearer ${token.current}` }) }),
    onError: (e) => { refreshCredits(); toast.error(e.message || t("chat.error")); },
    onFinish: () => refreshCredits(),
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { if (!seed || seed.nonce === used.current || busy) return;
    const t = setTimeout(() => { used.current = seed.nonce; void sendMessage({ text: seed.text, files: seed.image ? [{ type: "file", mediaType: "image/jpeg", url: seed.image, filename: "extrait.jpg" }] : [] }); }, 50);
    return () => clearTimeout(t); }, [seed, busy, sendMessage]);
  useEffect(() => { if (!busy) box.current?.focus(); }, [busy]);
  const clear = async () => { setMessages([]); const { error } = await supabase.from("doc_chats").delete().eq("document_id", documentId); if (error) toast.error(error.message); };
  return <div className="flex h-full min-h-0 flex-col">
    <Conversation className="min-h-0 flex-1"><ConversationContent>
      {messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("chat.empty")}</p>}
      {messages.map((m) => { const msgText = m.parts.map((p) => p.type === "text" ? p.text : "").join("").trim(); return <Message key={m.id} from={m.role}><MessageContent className={m.role === "user" ? "bg-foreground text-background" : ""}>
        {m.parts.map((p, i) => p.type === "text" ? (m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <p key={i} className="whitespace-pre-wrap">{p.text}</p>)
          : p.type === "file" && p.mediaType.startsWith("image/") ? <img key={i} src={p.url} alt={tf("Extrait sélectionné")} className="max-h-40 rounded border" /> : null)}
      </MessageContent>
        {!busy && msgText && <div className={m.role === "user" ? "flex items-center justify-end gap-1" : "flex items-center gap-1"}>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => { void navigator.clipboard.writeText(msgText).then(() => { setNotebookClip({ kind: "text", text: msgText }); toast.success(t("chat.copied")); }).catch(() => toast.error(t("chat.copyFailed"))); }}><Copy className="size-3.5" />{t("chat.copy")}</Button>
          {m.role === "user" ? <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => { setInput(msgText); requestAnimationFrame(() => box.current?.focus()); }}><Pencil className="size-3.5" />{t("chat.edit")}</Button>
            : onAddToPage && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={t("chat.addToPage")}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-60">
              <DropdownMenuItem onClick={() => onAddToPage(msgText, true)}><PenLine />{t("chat.addHandwritten")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddToPage(msgText, false)}><Type />{t("chat.addTyped")}</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>}
        </div>}
      </Message>; })}
      {status === "submitted" && <Message from="assistant"><MessageContent><span className="animate-pulse text-muted-foreground">{t("chat.thinking")}</span></MessageContent></Message>}
    </ConversationContent><ConversationScrollButton /></Conversation>
    <div className="flex items-center justify-between px-1 pb-1">{messages.length > 0 && <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void clear()}><Trash2 />{t("chat.clear")}</Button>}</div>
    <PromptInput onSubmit={({ text }) => { if (!text.trim() || busy) return; void sendMessage({ text }); setInput(""); }}>
      <PromptInputBody><PromptInputTextarea ref={box} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("chat.placeholder")} /></PromptInputBody>
      <PromptInputFooter className="justify-end"><PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} /></PromptInputFooter>
    </PromptInput>
  </div>;
}

export default function DocChat({ documentId, seed, onAddToPage }: { documentId: string; seed: ChatSeed | null; onAddToPage?: ((text: string, handwritten: boolean) => void) | undefined }) {
  const { t } = useI18n();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  useEffect(() => { let off = false; setInitial(null);
    void supabase.from("doc_chats").select("messages").eq("document_id", documentId).maybeSingle().then(({ data, error }) => { if (error) toast.error(error.message); if (!off) setInitial((data?.messages as unknown as UIMessage[]) ?? []); });
    return () => { off = true; }; }, [documentId]);
  return <div className="flex h-full min-h-0 flex-col gap-2">
    <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><GraduationCap className="size-4" /></span><div><h2 className="font-display text-lg font-bold leading-tight">{t("chat.title")}</h2><p className="text-xs text-muted-foreground">{t("chat.tagline")}</p></div></div>
    {initial ? <ChatInner key={documentId} documentId={documentId} initial={initial} seed={seed} onAddToPage={onAddToPage} /> : <p className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</p>}
  </div>;
}
