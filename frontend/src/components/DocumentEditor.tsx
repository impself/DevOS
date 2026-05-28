import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCursor from "@tiptap/extension-collaboration-cursor"
import { common, createLowlight } from "lowlight"
import type * as Y from "yjs"
import type { CollabProvider } from "@/lib/collab-provider"
import EditorToolbar from "./EditorToolbar"

const lowlight = createLowlight(common)

// Random cursor colors for different users
const CURSOR_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#34d399", "#22d3ee", "#60a5fa", "#a78bfa",
  "#f472b6", "#e879f9",
]

interface DocumentEditorProps {
  content: Record<string, unknown> | null
  onUpdate: (content: Record<string, unknown>) => void
  editable?: boolean
  // Collaborative mode props (optional)
  ydoc?: Y.Doc | null
  provider?: CollabProvider | null
  userName?: string
}

export default function DocumentEditor({
  content,
  onUpdate,
  editable = true,
  ydoc,
  provider,
  userName,
}: DocumentEditorProps) {
  const isCollab = !!ydoc && !!provider

  const userColor = CURSOR_COLORS[Math.abs(hashCode(userName || "anonymous")) % CURSOR_COLORS.length]

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        history: isCollab ? false : undefined,
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Highlight,
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ...(isCollab
        ? [
            Collaboration.configure({
              document: ydoc!,
            }),
            CollaborationCursor.configure({
              provider: provider,
              user: { name: userName || "Anonymous", color: userColor },
              render: (user) => {
                const cursor = document.createElement("span")
                cursor.classList.add("collab-cursor")
                cursor.style.borderColor = user.color

                const label = document.createElement("div")
                label.classList.add("collab-cursor-label")
                label.style.backgroundColor = user.color
                label.insertBefore(document.createTextNode(user.name || "Anonymous"), null)

                cursor.insertBefore(label, null)
                return cursor
              },
              selectionRender: (user) => ({
                nodeName: "span",
                class: "collab-selection",
                style: `background-color: ${user.color}22`,
              }),
            }),
          ]
        : []),
    ],
    content: content || { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-6 py-4",
      },
    },
  })

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

// Simple string hash for deterministic color assignment
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}
