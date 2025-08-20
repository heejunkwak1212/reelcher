import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await supabaseServer()
    
    // Check if user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate user ID
    const { userId } = deleteUserSchema.parse({ userId: params.id })

    // Create admin client for user deletion
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Delete user from auth (this will cascade delete profile due to RLS)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete user error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
