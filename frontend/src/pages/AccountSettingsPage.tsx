import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { updateProfile, uploadAvatar } from "@/api/auth"

export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(user?.nickname || "")
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadAvatar(file)
      if (res.code === 0) {
        setAvatarUrl(res.data.avatar)
        // update context
        updateUser({ ...user!, avatar: res.data.avatar, nickname: res.data.nickname || user!.nickname })
      }
    } catch {
      // silent
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateProfile(nickname, avatarUrl)
      if (res.code === 0) {
        updateUser({ ...user!, nickname: res.data.nickname, avatar: res.data.avatar })
        navigate(-1)
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const displayName = nickname || user?.username || "User"
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="p-6 lg:p-8 max-w-xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 cursor-pointer"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      <h1 className="text-xl font-bold mb-6">Account Settings</h1>

      <div className="border border-border rounded-lg p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="size-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border-2 border-border">
                {initial}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
              title="Upload avatar"
            >
              <Camera className="size-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Click camera icon to upload (max 2MB)</p>
          </div>
        </div>

        {/* Nickname */}
        <div className="space-y-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            className="h-9"
          />
          <p className="text-[10px] text-muted-foreground">Displayed name across the project. Leave empty to use username.</p>
        </div>

        {/* Username (read-only) */}
        <div className="space-y-2">
          <Label>Username</Label>
          <Input value={user?.username || ""} disabled className="h-9 bg-muted" />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled className="h-9 bg-muted" />
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
