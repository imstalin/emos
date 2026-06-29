"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bot,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  AssistantMessage,
  AssistantStatus,
} from "@/domain/types/assistant";
import { SUGGESTED_PROMPTS } from "@/domain/types/assistant";
import type { FollowUpTicketContext } from "@/domain/types/follow-up-ticket";
import { formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type FollowUpOption = {
  id: string;
  title: string;
  category: string;
  priority: string;
  assigneeName: string | null;
  webUrl: string | null;
};

interface AssistantViewProps {
  status: AssistantStatus;
}

const REPLY_PROMPT =
  "Read the ticket description and GitLab comments above. Suggest 2–3 reply comments I can post (Option A, B, C). Each should be ready to paste into GitLab, under 120 words, and reference the thread.";

async function sendChat(params: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  followUpId?: string;
}) {
  const response = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const body = (await response.json()) as {
    message?: AssistantMessage;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error ?? "Assistant request failed");
  }

  return body.message!;
}

async function fetchFollowUpTicket(followUpId: string): Promise<FollowUpTicketContext> {
  const response = await fetch(`/api/assistant/follow-ups/${followUpId}/ticket`);
  if (!response.ok) {
    throw new Error("Failed to load ticket context");
  }
  return response.json();
}

export function AssistantView({ status }: AssistantViewProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | null>(
    null,
  );

  const followUpsQuery = useQuery({
    queryKey: ["assistant-follow-ups"],
    queryFn: async () => {
      const response = await fetch("/api/assistant/follow-ups");
      if (!response.ok) throw new Error("Failed to load follow-ups");
      return response.json() as Promise<{ items: FollowUpOption[] }>;
    },
    enabled: status.configured,
  });

  const ticketQuery = useQuery({
    queryKey: ["assistant-follow-up-ticket", selectedFollowUpId],
    queryFn: () => fetchFollowUpTicket(selectedFollowUpId!),
    enabled: status.configured && Boolean(selectedFollowUpId),
  });

  const chatMutation = useMutation({
    mutationFn: sendChat,
    onSuccess: (assistantMessage) => {
      setMessages((current) => [...current, assistantMessage]);
    },
  });

  const sendMessage = (content: string, followUpId?: string | null) => {
    const trimmed = content.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    chatMutation.mutate({
      messages: nextMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      followUpId: followUpId ?? selectedFollowUpId ?? undefined,
    });
  };

  const requestReplySuggestions = () => {
    if (!selectedFollowUpId) return;
    sendMessage(REPLY_PROMPT, selectedFollowUpId);
  };

  return (
    <>
      <AppHeader
        title="AI Assistant"
        description="Delivery-aware answers powered by your live EMOS data"
        actions={
          status.configured ? (
            <Badge variant="outline" className="gap-1">
              <Sparkles className="size-3" />
              {status.model}
            </Badge>
          ) : (
            <Badge variant="destructive">OpenAI not configured</Badge>
          )
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-6">
        <div className="flex min-h-[32rem] flex-1 flex-col gap-4">
          {!status.configured ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Add <code className="text-foreground">OPENAI_API_KEY</code> to
                your <code className="text-foreground">.env</code> file and
                restart the dev server to enable the assistant.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    disabled={chatMutation.isPending}
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>

              <Card className="flex flex-1 flex-col overflow-hidden">
                <ScrollArea className="flex-1 min-h-[24rem]">
                  <div className="space-y-4 p-4">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-sm text-muted-foreground">
                        <Bot className="size-10 opacity-40" />
                        <p>
                          Select a follow-up to load its GitLab thread, then
                          ask for reply suggestions.
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))
                    )}
                    {chatMutation.isPending ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Thinking…
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>

                {chatMutation.isError ? (
                  <p className="border-t px-4 py-2 text-sm text-destructive">
                    {(chatMutation.error as Error).message}
                  </p>
                ) : null}

                <form
                  className="flex gap-2 border-t p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMessage(input);
                  }}
                >
                  <Input
                    placeholder="Ask the assistant…"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={chatMutation.isPending}
                  />
                  <Button
                    type="submit"
                    disabled={!input.trim() || chatMutation.isPending}
                  >
                    <Send />
                    Send
                  </Button>
                </form>
              </Card>
            </>
          )}
        </div>

        {status.configured ? (
          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Priority follow-ups</CardTitle>
                <CardDescription>
                  Load ticket thread and suggest GitLab replies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {followUpsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading…
                  </div>
                ) : followUpsQuery.data?.items.length ? (
                  followUpsQuery.data.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                        selectedFollowUpId === item.id &&
                          "border-primary bg-primary/5",
                      )}
                      onClick={() => setSelectedFollowUpId(item.id)}
                    >
                      <p className="font-medium line-clamp-2">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.priority} · {item.category}
                        {item.assigneeName ? ` · ${item.assigneeName}` : ""}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No critical or high follow-ups right now.
                  </p>
                )}
              </CardContent>
            </Card>

            {selectedFollowUpId ? (
              <Card>
                <CardHeader className="space-y-2">
                  <CardTitle className="text-base">Ticket thread</CardTitle>
                  {ticketQuery.data?.webUrl ? (
                    <a
                      href={ticketQuery.data.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                      Open in GitLab
                    </a>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {ticketQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading description & comments…
                    </div>
                  ) : ticketQuery.isError ? (
                    <p className="text-sm text-destructive">
                      Could not load ticket from GitLab.
                    </p>
                  ) : ticketQuery.data ? (
                    <>
                      <TicketPreview ticket={ticketQuery.data} />
                      <Button
                        className="w-full"
                        size="sm"
                        disabled={chatMutation.isPending}
                        onClick={requestReplySuggestions}
                      >
                        <MessageSquare className="size-4" />
                        Suggest reply comments
                      </Button>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function TicketPreview({ ticket }: { ticket: FollowUpTicketContext }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Description
        </p>
        <p className="mt-1 line-clamp-6 text-muted-foreground">
          {ticket.description ?? "No description in EMOS."}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Comments ({ticket.comments.length})
        </p>
        {ticket.comments.length === 0 ? (
          <p className="mt-1 text-muted-foreground">
            {ticket.commentsSource === "unavailable"
              ? "Could not load from GitLab."
              : "No comments yet."}
          </p>
        ) : (
          <ScrollArea className="mt-1 max-h-48">
            <ul className="space-y-2">
              {ticket.comments.slice(-8).map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
                >
                  <p className="font-medium">
                    {comment.authorName}{" "}
                    <span className="text-muted-foreground">
                      · {formatRelativeDate(comment.createdAt)}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-muted-foreground">
                    {comment.body}
                  </p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser ? (
          <Button
            variant="ghost"
            size="xs"
            className="mt-2 h-6 px-2"
            onClick={() => void navigator.clipboard.writeText(message.content)}
          >
            <Copy className="size-3" />
            Copy
          </Button>
        ) : null}
      </div>
    </div>
  );
}
