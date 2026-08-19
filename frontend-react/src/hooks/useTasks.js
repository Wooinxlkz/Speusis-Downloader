import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../lib/tauri";

/**
 * Mirrors app.js's taskStore + speedMap + api.onEvent reducer exactly:
 * fetch the initial list once, then apply live "event-bus" events
 * (DownloadStarted/Progress/Completed/Failed/Paused/Resumed,
 * SecurityScanStarted/Completed) on top of it. Same event names/payload
 * shapes as the old code - verified against it directly, not guessed.
 */
export function useTasks() {
  const [tasks, setTasks] = useState(new Map());
  const [speeds, setSpeeds] = useState(new Map());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const upsert = useCallback((id, patch) => {
    setTasks((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) || { id };
      next.set(id, { ...existing, ...patch });
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listDownloads();
        if (cancelled) return;
        const map = new Map();
        for (const t of list) map.set(t.id, t);
        setTasks(map);
      } catch {
        /* leave empty on failure - matches old app.js's silent catch */
      }
    })();

    const unlisten = api.onEvent((event, payload) => {
      const id = payload?.id;
      if (!id) return;
      const current = tasksRef.current.get(id);

      switch (event) {
        case "DownloadStarted":
          upsert(id, { ...(current || { createdAt: Date.now() }), ...payload, status: "running" });
          break;
        case "DownloadProgress":
          if (!current) break;
          setSpeeds((prev) => new Map(prev).set(id, payload.speed || 0));
          upsert(id, { receivedBytes: payload.bytesReceived, size: payload.size ?? current.size });
          break;
        case "DownloadCompleted":
          upsert(id, { ...payload, status: "completed" });
          setSpeeds((prev) => new Map(prev).set(id, 0));
          break;
        case "DownloadFailed":
          if (current && (current.status === "paused" || current.status === "cancelled")) break;
          upsert(id, { status: "failed" });
          setSpeeds((prev) => new Map(prev).set(id, 0));
          break;
        case "DownloadPaused":
          if (!current) break;
          upsert(id, { status: "paused" });
          setSpeeds((prev) => new Map(prev).set(id, 0));
          break;
        case "DownloadResumed":
          if (!current) break;
          upsert(id, { status: "running" });
          break;
        case "SecurityScanStarted":
          upsert(id, { securityScan: { status: "pending", scanner: payload.scanner, message: "Scanning downloaded file..." } });
          break;
        case "SecurityScanCompleted":
          upsert(id, { securityScan: { status: payload.status, scanner: payload.scanner, message: payload.message, scannedAt: Date.now() } });
          break;
        default:
          break;
      }
    });

    return () => {
      cancelled = true;
      unlisten();
    };
  }, [upsert]);

  const removeTask = useCallback((id) => {
    setTasks((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setSpeeds((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { tasks, speeds, removeTask, upsert };
}
