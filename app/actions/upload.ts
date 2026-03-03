'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Upload a payment proof image to the 'vouchers' storage bucket.
 * Uses the admin client to bypass storage RLS policies,
 * so staff users can upload images just like admins.
 *
 * @param formData - FormData containing 'file' (the image) and 'subscriberId'
 * @returns { url: string } on success, or { error: string } on failure
 */
export async function uploadPaymentProof(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  try {
    // Verify the user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    // Extract file and subscriber ID from form data
    const file = formData.get('file') as File | null;
    const subscriberId = formData.get('subscriberId') as string | null;

    if (!file) {
      return { error: 'No file provided' };
    }

    if (!subscriberId) {
      return { error: 'No subscriber ID provided' };
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { error: 'File must be an image' };
    }

    // Validate file size (max 5MB after compression)
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'File size must be less than 5MB' };
    }

    // Convert File to buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using admin client to bypass storage RLS
    const adminSupabase = createAdminClient();
    const fileName = `${subscriberId}/${Date.now()}.webp`;

    const { error: uploadError } = await adminSupabase.storage
      .from('vouchers')
      .upload(fileName, buffer, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { error: `Upload failed: ${uploadError.message}` };
    }

    // Get the public URL
    const { data: urlData } = adminSupabase.storage
      .from('vouchers')
      .getPublicUrl(fileName);

    return { url: urlData.publicUrl };
  } catch (error) {
    console.error('Upload error:', error);
    return { error: 'An unexpected error occurred during upload' };
  }
}
