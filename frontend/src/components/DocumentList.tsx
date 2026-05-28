import { FileText, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Document } from "@/api/document"

interface DocumentListProps {
  documents: Document[]
  total: number
  search: string
  canEdit: boolean
  onSearchChange: (v: string) => void
  onCreate: () => void
  onOpen: (doc: Document) => void
  onDelete: (doc: Document) => void
}

export default function DocumentList({
  documents, total, search, canEdit,
  onSearchChange, onCreate, onOpen, onDelete,
}: DocumentListProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Documents ({total})</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search documents..."
              className="h-8 w-48 pl-8 text-sm"
            />
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onCreate} className="cursor-pointer">
              <Plus className="size-3.5 mr-1" />
              New Document
            </Button>
          )}
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="size-8 mb-2 opacity-40" />
          <p className="text-sm">No documents yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onOpen(doc)}
              className="group border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">{doc.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    By {doc.creator_nickname || doc.creator_name || "Unknown"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Updated {new Date(doc.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(doc) }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                    title="Delete document"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
