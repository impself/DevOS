import { type Editor } from "@tiptap/react"
import {
  Bold, Italic, Underline, Strikethrough, Code, Highlighter,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks,
  AlignLeft, AlignCenter, AlignRight,
  Link, Image, CodeSquare,
  Undo2, Redo2,
} from "lucide-react"

interface EditorToolbarProps {
  editor: Editor | null
}

interface ToolbarBtnProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarBtn({ onClick, isActive, disabled, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed
        ${isActive ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5" />
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 p-1.5 border-b border-border bg-muted/30 rounded-t-lg flex-wrap">
      {/* History */}
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo2 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo2 className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Text formatting */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
        <Bold className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
        <Italic className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
        <Underline className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline Code">
        <Code className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} title="Highlight">
        <Highlighter className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
        <Heading1 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <Heading2 className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <Heading3 className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
        <List className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Ordered List">
        <ListOrdered className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive("taskList")} title="Task List">
        <ListChecks className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })} title="Align Left">
        <AlignLeft className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })} title="Align Center">
        <AlignCenter className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })} title="Align Right">
        <AlignRight className="size-3.5" />
      </ToolbarBtn>

      <ToolbarDivider />

      {/* Insert */}
      <ToolbarBtn
        onClick={() => {
          const url = window.prompt("Enter URL:")
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        isActive={editor.isActive("link")}
        title="Insert Link"
      >
        <Link className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => {
          const url = window.prompt("Enter image URL:")
          if (url) editor.chain().focus().setImage({ src: url }).run()
        }}
        title="Insert Image"
      >
        <Image className="size-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code Block">
        <CodeSquare className="size-3.5" />
      </ToolbarBtn>
    </div>
  )
}
