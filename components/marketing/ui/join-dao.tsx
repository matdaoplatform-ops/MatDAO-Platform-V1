"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAuth } from "@/context/auth-context"
import { PillButton } from "./controls"
import { useI18n } from "../i18n"

/**
 * "Join the DAO" for investors.
 * - Signed out: goes to sign-up.
 * - Signed in, no wallet: opens the app's existing RainbowKit modal (no second wallet library).
 * - Signed in with a wallet: links to the investor dashboard.
 */
export function JoinDaoButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const { t } = useI18n()
  const { user, isLoading } = useAuth()

  if (isLoading || !user) {
    return (
      <PillButton href="/auth/sign-up" variant={variant} arrow>
        {t.cta.join}
      </PillButton>
    )
  }

  return (
    <ConnectButton.Custom>
      {({ account, mounted, openConnectModal }) => {
        const connected = mounted && !!account
        if (connected) {
          return (
            <PillButton href="/investor-dashboard" variant={variant} arrow>
              {t.cta.connected}
            </PillButton>
          )
        }
        return (
          <PillButton onClick={openConnectModal} variant={variant} arrow>
            {t.cta.join}
          </PillButton>
        )
      }}
    </ConnectButton.Custom>
  )
}
