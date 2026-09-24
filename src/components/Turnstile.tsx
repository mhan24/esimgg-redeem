"use client";

/**
 * Cloudflare Turnstile 前端组件 (显式渲染, 规格 §69)
 * 文档: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 *
 * - 站点密钥来自 /api/turnstile/config (运行时), 不依赖构建期内联
 * - api.js 只加载一次 (模块级 Promise 去重)
 * - 未启用时不渲染, 表单按无验证提交
 * - token 一次性: 过期/出错时通过 onExpire 通知父组件清空
 */
import { useEffect, useRef, useState } from "react";
import { useTurnstile } from "./TurnstileProvider";

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/** 加载 Turnstile api.js (全局只加载一次) */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("turnstile: 仅在浏览器端加载"));
  }
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile-src="1"]',
    );
    const el = existing ?? document.createElement("script");
    el.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    el.async = true;
    el.defer = true;
    el.dataset.turnstileSrc = "1";
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => {
      scriptPromise = null; // 允许下次重试
      reject(new Error("turnstile: api.js 加载失败"));
    });
    if (!existing) document.head.appendChild(el);
  });
  return scriptPromise;
}

export interface TurnstileProps {
  /** 校验通过, 拿到一次性 token */
  onVerify: (token: string) => void;
  /** token 过期/被撤销 */
  onExpire?: () => void;
  /** 组件加载失败 (脚本被拦截/网络异常) */
  onError?: (message: string) => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

export function Turnstile({
  onVerify,
  onExpire,
  onError,
  theme = "auto",
  className,
}: TurnstileProps) {
  const { ready, enabled, siteKey } = useTurnstile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // 回调放进 ref: 避免父组件 state 变化导致 widget 重复渲染
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  // 每次渲染后同步最新回调 (ref 在渲染期不可写)
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    // 未配置/未就绪: 不渲染
    if (!ready || !enabled || !siteKey) return;
    let cancelled = false;
    let widgetId: string | null = null;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onVerifyRef.current(token),
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => {
            onExpireRef.current?.();
            setFailed(true);
            onErrorRef.current?.("人机验证加载失败，请刷新页面重试");
          },
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailed(true);
        onErrorRef.current?.(
          err instanceof Error ? err.message : "人机验证组件加载失败，请刷新页面重试",
        );
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // 忽略重复移除
        }
      }
    };
  }, [ready, enabled, siteKey, theme]);

  if (!ready || !enabled || !siteKey) return null;

  return (
    <div className={className}>
      <div ref={containerRef} aria-label="人机验证" />
      {failed && (
        <p className="mt-1.5 text-xs text-warning-foreground">
          人机验证组件加载异常，刷新页面后重试
        </p>
      )}
    </div>
  );
}
