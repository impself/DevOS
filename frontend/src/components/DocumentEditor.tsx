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
import { common, createLowlight } from "lowlight"
import type * as Y from "yjs"
import EditorToolbar from "./EditorToolbar"

const lowlight = createLowlight(common)

interface DocumentEditorProps {
  content: Record<string, unknown> | null
  onUpdate: (content: Record<string, unknown>) => void
  editable?: boolean
  // Collaborative mode: Y.Doc instance enables real-time sync
  ydoc?: Y.Doc | null
}

export default function DocumentEditor({
  content,
  onUpdate,
  editable = true,
  ydoc,
}: DocumentEditorProps) {
  const isCollab = !!ydoc

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
      // Collaboration extension — binds TipTap to Yjs for real-time sync
      ...(isCollab
        ? [
            Collaboration.configure({
              document: ydoc!,
            }),
          ]
        : []),
    ],
    // Always pass content — Collaboration extension uses it to initialize
    // the Yjs XmlFragment when empty, or uses server-synced state if present.
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
