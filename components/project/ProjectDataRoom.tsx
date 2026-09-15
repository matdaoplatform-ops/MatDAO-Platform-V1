"use client"

import { useState } from "react"
import { useAccount, useSignMessage } from "wagmi"
import { Lock, Unlock, FileText, Shield, Loader2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "react-hot-toast"
import { buildVdrMessage, generateVdrNonce } from "@/lib/web3/vdrMessage"

interface Document {
  id: string
  title: string
  type: string
  size: string
  projectId: string
}

const MOCK_DOCUMENTS: Document[] = [
  {
    id: "doc-1",
    title: "Phase 1 Lab Results.pdf",
    type: "PDF",
    size: "2.4 MB",
    projectId: "terra-doc-1"
  },
  {
    id: "doc-2", 
    title: "Chula TTO Commercialization Strategy.pdf",
    type: "PDF",
    size: "1.8 MB",
    projectId: "terra-doc-1"
  },
  {
    id: "doc-3",
    title: "Patent Filing - Biochar Process.pdf",
    type: "PDF",
    size: "3.1 MB",
    projectId: "terra-doc-1"
  },
  {
    id: "doc-4",
    title: "Technical Specifications v2.0.pdf",
    type: "PDF",
    size: "1.2 MB",
    projectId: "terra-doc-1"
  }
]

interface ProjectDataRoomProps {
  projectId: string
  iptAddress?: string
}

export function ProjectDataRoom({ projectId, iptAddress }: ProjectDataRoomProps) {
  const { address } = useAccount()
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [isCheckingAccess, setIsCheckingAccess] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [documentStream, setDocumentStream] = useState<string | null>(null)
  
  const { signMessage, isPending: isSigning } = useSignMessage({
    mutation: {
      onSuccess: async (signature, variables) => {
        await verifyAccess(typeof variables.message === "string" ? variables.message : "", signature)
      },
      onError: (error) => {
        console.error("Signature error:", error)
        toast.error("Failed to sign message")
        setIsCheckingAccess(false)
      }
    }
  })

  const verifyAccess = async (message: string, signature: string) => {
    if (!address || !selectedDoc || !message) return

    setIsCheckingAccess(true)
    
    try {
      const response = await fetch('/api/vdr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          message,
          signature,
          projectId: selectedDoc.projectId
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setDocumentStream(url)
        setHasAccess(true)
        toast.success("Access granted - Document unlocked")
      } else {
        const error = await response.json().catch(() => ({}))
        toast.error(error.message || "Access denied")
        setHasAccess(false)
      }
    } catch (error) {
      console.error("Verification error:", error)
      toast.error("Failed to verify access")
      setHasAccess(false)
    } finally {
      setIsCheckingAccess(false)
    }
  }

  const handleDocumentClick = (doc: Document) => {
    setSelectedDoc(doc)
    setHasAccess(false)
    setDocumentStream(null)
    
    if (!address) {
      toast.error("Please connect your wallet first")
      return
    }

    // Domain/project/address/nonce/timestamp-bound message (verified by /api/vdr).
    const message = buildVdrMessage({
      domain: window.location.host,
      projectId: doc.projectId,
      address,
      nonce: generateVdrNonce(),
      timestamp: Math.floor(Date.now() / 1000),
    })

    signMessage({ message })
  }

  const closeDocumentViewer = () => {
    setSelectedDoc(null)
    setHasAccess(false)
    setDocumentStream(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Virtual Data Room
        </CardTitle>
        <CardDescription>
          Token-gated access to confidential research documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!selectedDoc ? (
          <div className="space-y-3">
            {MOCK_DOCUMENTS.map((doc) => (
              <div
                key={doc.id}
                onClick={() => handleDocumentClick(doc)}
                className="group relative p-4 border border-border/60 rounded-lg hover:border-primary/40 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {doc.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {doc.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{doc.size}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-secondary/20 rounded-lg">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                
                {/* Locked overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent backdrop-blur-[1px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Document Viewer Header */}
            <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {hasAccess ? (
                    <Unlock className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedDoc.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {hasAccess ? (
                      <Badge className="bg-emerald-500 text-white">
                        <Eye className="h-3 w-3 mr-1" />
                        Unlocked
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <Lock className="h-3 w-3 mr-1" />
                        Restricted Access
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={closeDocumentViewer}
              >
                Close
              </Button>
            </div>

            {/* Document Content */}
            <div className="relative min-h-[400px] border border-border/60 rounded-lg overflow-hidden">
              {isCheckingAccess ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Verifying cryptographic ownership on-chain...
                  </p>
                </div>
              ) : hasAccess && documentStream ? (
                <iframe
                  src={documentStream}
                  className="w-full h-[500px]"
                  title={selectedDoc.title}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
                  <div className="p-6 bg-secondary/20 rounded-full mb-4">
                    <Lock className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-2">
                    Restricted Access
                  </p>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Must hold Project IPTs to view confidential IP. Click the document again to verify your token ownership.
                  </p>
                </div>
              )}
            </div>

            {/* Security Notice */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                <strong>Security Notice:</strong> This document is protected by cryptographic wallet-signature verification. Access is granted only to verified IPT token holders.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
