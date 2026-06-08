"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/sgp/utils";

type RecordDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  subtitle?: ReactNode;
  resizable?: boolean;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
};

export function RecordDrawer({
  open,
  title,
  onClose,
  children,
  subtitle,
  resizable = false,
  initialWidth = 460,
  minWidth = 360,
  maxWidth = 720,
}: RecordDrawerProps) {
  const [width, setWidth] = useState(initialWidth);
  const [isMobile, setIsMobile] = useState(false);
  const resizeData = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setWidth(Math.min(window.innerWidth - 16, maxWidth));
      } else {
        setWidth((prev) => Math.min(maxWidth, Math.max(minWidth, prev)));
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [maxWidth, minWidth]);

  useEffect(() => {
    function onPointerMove(event: globalThis.PointerEvent) {
      if (!resizeData.current || isMobile) return;
      const delta = resizeData.current.startX - event.clientX;
      const next = resizeData.current.startWidth + delta;
      setWidth(Math.min(maxWidth, Math.max(minWidth, next)));
    }

    function onPointerUp() {
      resizeData.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isMobile, maxWidth, minWidth]);

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizable || isMobile) return;
    resizeData.current = { startX: event.clientX, startWidth: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const drawerStyle: CSSProperties = isMobile ? { width: "calc(100vw - 8px)" } : { width };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        style={drawerStyle}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full flex-col border-l border-stone-200 bg-panel shadow-lg transition",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {resizable && !isMobile ? (
          <div
            onPointerDown={startResize}
            className="absolute left-0 top-0 h-full w-[6px] -translate-x-[3px] cursor-col-resize"
            aria-label="Redimensionar drawer"
          />
        ) : null}
        <div className="sticky top-0 z-10 border-b border-border bg-panel px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-muted hover:bg-stone-100"
            >
              Cerrar
            </button>
          </div>
          {subtitle ? <div className="mt-1">{subtitle}</div> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">{children}</div>
      </aside>
    </>
  );
}
