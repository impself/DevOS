import PlaceholderPage from "@/components/PlaceholderPage"
import { GitBranch } from "lucide-react"

export default function CodePage() {
  return (
    <PlaceholderPage
      icon={GitBranch}
      title="Code"
      description="Browse repositories, manage pull requests, track commits, and integrate CI/CD pipelines. Powered by Gitea with AI-enhanced code review."
    />
  )
}
