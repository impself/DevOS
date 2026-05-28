import PlaceholderPage from "@/components/PlaceholderPage"
import { ShieldCheck } from "lucide-react"

export default function AuditPage() {
  return (
    <PlaceholderPage
      icon={ShieldCheck}
      title="Audit Log"
      description="Track all system activities — who did what, when, and what changed. Essential for security review, compliance, and project timeline reconstruction."
    />
  )
}
