"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import { PillButton } from "./controls"
import { useI18n } from "../i18n"

/**
 * "Join the DAO": opens the wallet modal from the app's existing RainbowKit /
 * wagmi setup (no second wallet library). Once connected it links to the
 * investor dashboard.
 */
export function JoinDaoButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const { t } = useI18n()
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
