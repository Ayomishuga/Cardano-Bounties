import { supabaseAdmin } from "./supabase";

type NotificationType = 
| 'submission_approved'
| 'submission_rejected'
| 'submission_not_selected'
| 'bounty_approved'
| 'bounty_rejected'
| 'new_submission'
| 'payment_released'
| 'announcement'

export async function createNotification({
    userId,
    type,
    title,
    message,
    relatedId
}: {
    userId: string
    type: NotificationType
    title: string
    message: string
    relatedId?: string
}) {
    const { error } = await supabaseAdmin
    .from('notifications')
    .insert({
        user_id: userId,
        type,
        title,
        message,
        related_id: relatedId || null
    })

    if (error) {
        console.error('Failed to create notidication:', error)
    }
}
