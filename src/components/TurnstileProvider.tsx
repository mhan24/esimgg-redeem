"use client";

/**
 * Turnstile 配置上下文 (规格 §69)
 * 通过 /api/turnstile/config 在运行时获取配置, 避免 NEXT_PUBLIC_* 构建期内联
 * 导致 Docker 构建 (.dockerignore 排除 .env) 与运行时环境不一致。
 * 多个页面/组件共享同一份配置, 只请求一次。
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface TurnstileConfig {
  /** 配置是否已加载完成 */
  ready: boolean;
  /** 服务端是否启用了 Turnstile 校验 (密钥 + 站点密钥均已配置) */
  enabled: boolean;
  /** 站点密钥 (公开信息) */
  siteKey: string;
}

const INITIAL: TurnstileConfig = { ready: false, enabled: false, siteKey: "" };

const TurnstileContext = createContext<TurnstileConfig>(INITIAL);

export function TurnstileProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TurnstileConfig>(INITIAL);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let active = true;
    fetch("/api/turnstile/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: unknown; siteKey?: unknown } | null) => {
        if (!active) return;
        const siteKey = typeof data?.siteKey === "string" ? data.siteKey : "";
        setConfig({
          ready: true,
          enabled: data?.enabled === true && siteKey.length > 0,
          siteKey,
        });
      })
      .catch(() => {
        // 配置获取失败: 按未启用处理 (服务端仍会强制校验, 不会造成绕过)
        if (active) setConfig({ ready: true, enabled: false, siteKey: "" });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <TurnstileContext.Provider value={config}>{children}</TurnstileContext.Provider>
  );
}

export function useTurnstile(): TurnstileConfig {
  return useContext(TurnstileContext);
}
