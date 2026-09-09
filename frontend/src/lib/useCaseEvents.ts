"use client";

import { useEffect, useRef } from "react";
import { Case, WS_URL } from "./api";

type CaseEvent =
  | { event: "case_created"; case: Case }
  | { event: "case_updated"; case: Case };

export function useCaseEvents(onEvent: (evt: CaseEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closedByCleanup = false;
    let retryDelay = 1000;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as CaseEvent;
          handlerRef.current(data);
        } catch {}
      };
      ws.onclose = () => {
        if (closedByCleanup) return;
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10000);
      };
    }

    connect();
    return () => {
      closedByCleanup = true;
      ws?.close();
    };
  }, []);
}
