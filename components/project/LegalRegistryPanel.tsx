"use client"

import { useReadContract } from "wagmi"
import { FileText, Building2, Hash, CheckCircle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IPNFT_ABI } from "@/lib/web3/abis"
import { TARGET_CHAIN_ID } from "@/lib/web3/config"

interface LegalRegistryPanelProps {
  ipnftAddress: string
  /** ERC-721 token id. Token ids start at 1; 0 is never a valid token. */
  tokenId: number | bigint
}

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000"
const isAddress = (a?: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a || "")

export function LegalRegistryPanel({ ipnftAddress, tokenId }: LegalRegistryPanelProps) {
  const id = BigInt(tokenId)
  const enabled = isAddress(ipnftAddress) && id > 0n
  const readConfig = { address: ipnftAddress as `0x${string}`, abi: IPNFT_ABI, chainId: TARGET_CHAIN_ID, query: { enabled } } as const

  const { data: legalHash } = useReadContract({ ...readConfig, functionName: "legalAgreementHashes", args: [id] })
  const { data: licenses } = useReadContract({ ...readConfig, functionName: "getActiveLicenses", args: [id] })

  // bytes32(0) is what an unminted / unrecorded token returns - it is truthy as a string!
  const hasLegalHash = Boolean(legalHash) && legalHash !== ZERO_HASH

  const licenseData = licenses
  const hasActiveLicenses = Boolean(licenseData?.[0]?.length)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          On-Chain Legal Registry
        </CardTitle>
        <CardDescription>
          Cryptographically bound legal agreements and enterprise licenses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Legal Agreement Hash */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Legal Agreement Hash</h3>
            <Badge variant="outline">
              {hasLegalHash ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {hasLegalHash ? "ON-CHAIN HASH RECORDED" : "NOT RECORDED"}
            </Badge>
          </div>
          
          <div className="p-4 bg-secondary/20 border border-border/60 rounded-lg">
            <div className="flex items-start gap-2">
              <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <code className="text-xs text-muted-foreground break-all font-mono">
                {hasLegalHash
                  ? legalHash
                  : !enabled
                    ? "No token id / contract configured for this project yet."
                    : "No legal-agreement hash has been recorded for this token."}
              </code>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            An on-chain hash can prove that a specific document fingerprint was recorded. It does not itself establish ownership, licensing, or legal enforceability; those require the underlying agreements and applicable legal review.
          </p>
        </div>

        {/* Enterprise Sub-Licenses */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Enterprise Sub-Licenses
          </h3>
          
          {hasActiveLicenses ? (
            <div className="border border-border/60 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20">
                    <TableHead className="text-xs">Licensee</TableHead>
                    <TableHead className="text-xs">Expires Block</TableHead>
                    <TableHead className="text-xs">Terms Hash</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenseData![0].map((licensee, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs font-mono">
                        {licensee.slice(0, 6)}...{licensee.slice(-4)}
                      </TableCell>
                      <TableCell className="text-xs">
                        #{licenseData![1][index].toString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {licenseData![2][index].slice(0, 10)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-4 bg-secondary/20 border border-border/60 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">No Active Licenses</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This IP-NFT has not yet been licensed to enterprise partners. When R2C is achieved, corporate licenses will appear here.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Enterprise sub-licenses demonstrate successful "Research-to-Commercialization" (R2C) achievement, proving the asset has transitioned from academic research to commercial application.
          </p>
        </div>

        {/* Security Notice */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            <strong>Important:</strong> verify every agreement, party authorization, jurisdictional requirement, and regulatory obligation before presenting any tokenized asset to investors.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
