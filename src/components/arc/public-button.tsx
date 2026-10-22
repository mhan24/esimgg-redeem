"use client";

import { Button, type ButtonProps } from "./button";

/** Keep the redemption API stable while adopting Arc's press and loading states. */
export function PublicButton({ variant = "primary", loading, disabled, className = "", ...props }: Omit<ButtonProps, "variant"> & { variant?: ButtonProps["variant"] | "outline" }) {
  return <Button {...props} data-slot="button" variant={variant === "outline" ? "secondary" : variant} loading={loading} disabled={disabled || loading} className={`arc-public-button ${className}`} />;
}
