import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerResult } from "../api/client";

interface VoiceWsOptions {
  sessionId: number | null;
  token: string | null;
  onAnswerResult?: (result: AnswerResult) => void;
  onQuestion?: (text: string) => void;
  onError?: (message: string) => void;
}

export function useVoiceWebSocket({
  sessionId,
  token,
  onAnswerResult,
  onQuestion,
  onError,
}: VoiceWsOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef({ onAnswerResult, onQuestion, onError });

  useEffect(() => {
    callbacksRef.current = { onAnswerResult, onQuestion, onError };
  }, [onAnswerResult, onQuestion, onError]);

  useEffect(() => {
    if (!sessionId || !token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(
      `${protocol}//${host}/api/v1/voice/ws?token=${encodeURIComponent(token)}`
    );

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => {
      setConnected(false);
      callbacksRef.current.onError?.("语音连接失败");
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "answer_result") {
          callbacksRef.current.onAnswerResult?.({
            evaluation: data.evaluation,
            nextQuestion: data.nextQuestion ?? null,
            questionCount: data.questionCount,
            isComplete: data.isComplete,
            maxQuestions: data.maxQuestions ?? 8,
            elapsedSec: data.elapsedSec ?? 0,
            stage: data.stage,
            techAgenda: data.techAgenda,
            currentTech: data.currentTech,
          });
        } else if (data.type === "question" && data.text) {
          callbacksRef.current.onQuestion?.(data.text);
        } else if (data.type === "error") {
          callbacksRef.current.onError?.(data.text || "语音服务错误");
        }
      } catch {
        callbacksRef.current.onError?.("语音消息解析失败");
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [sessionId, token]);

  const sendAnswer = useCallback(
    (text: string, elapsedSec: number) => {
      if (!sessionId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false;
      }
      wsRef.current.send(
        JSON.stringify({
          type: "answer",
          sessionId,
          text,
          elapsedSec,
          messageType: "voice",
        })
      );
      return true;
    },
    [sessionId]
  );

  return { connected, sendAnswer };
}
