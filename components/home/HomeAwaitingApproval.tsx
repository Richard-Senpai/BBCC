import { Clock, ShieldCheck } from 'lucide-react'
import type { HomePendingRequest } from '@/lib/actions/home'

interface HomeAwaitingApprovalProps {
  pendingRequests: HomePendingRequest[]
}

export default function HomeAwaitingApproval({
  pendingRequests,
}: HomeAwaitingApprovalProps) {
  if (pendingRequests.length === 0) return null

  return (
    <section className="px-4 mt-4">
      <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 transition-colors">
        <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
          <Clock size={16} strokeWidth={2} />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Awaiting Pastoral Approval
          </h3>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
          Your request to join is under review by pastoral leadership. You will be notified as soon as you are approved.
        </p>

        <div className="space-y-2">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="font-semibold text-[var(--text-ink)] truncate font-serif">
                  {req.title}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                Pending Review
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
