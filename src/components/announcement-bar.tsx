import type { PublicAnnouncement } from "@/lib/db/repository";
export function AnnouncementBar({items}:{items:PublicAnnouncement[]}){if(items.length===0)return null;return <aside className="border-b bg-primary px-4 py-2 text-center text-xs text-background" aria-label="Pengumuman">{items.map(item=><p key={item.id}><strong>{item.title}:</strong> {item.message}</p>)}</aside>}
