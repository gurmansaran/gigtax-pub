/**
 * Receipt Storage Service
 * Handles receipt images and metadata storage in Supabase
 */

import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export interface Receipt {
  id: string;
  userId: string;
  expenseId?: string; // Linked to an expense if attached
  imageUri: string;
  cloudUrl?: string; // Supabase Storage URL
  amount?: number;
  date?: string;
  merchantName?: string;
  category?: string;
  createdAt: string;
}

/**
 * Request camera/photo library permissions
 */
export async function requestReceiptPermissions(): Promise<boolean> {
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
  const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return cameraStatus === 'granted' || libraryStatus === 'granted';
}

/**
 * Pick an image from library or camera
 */
export async function pickReceiptImage(): Promise<string | null> {
  try {
    const hasPermission = await requestReceiptPermissions();
    if (!hasPermission) {
      throw new Error('Camera/Photo library permission denied');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}

/**
 * Take a photo with camera
 */
export async function takeReceiptPhoto(): Promise<string | null> {
  try {
    const hasPermission = await requestReceiptPermissions();
    if (!hasPermission) {
      throw new Error('Camera permission denied');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
}

/**
 * Upload receipt image to Supabase Storage
 */
export async function uploadReceiptImage(
  userId: string,
  imageUri: string,
  expenseId?: string
): Promise<string> {
  try {
    // Read file as blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Generate unique filename
    const filename = `receipts/${userId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filename);

    // Save receipt metadata
    const { error: dbError } = await supabase.from('receipts').insert({
      user_id: userId,
      expense_id: expenseId,
      cloud_url: urlData.publicUrl,
      created_at: new Date().toISOString(),
    });

    if (dbError) throw dbError;

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading receipt:', error);
    throw error;
  }
}

/**
 * Get all receipts for a user
 */
export async function getReceipts(userId: string): Promise<Receipt[]> {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Receipt[];
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return [];
  }
}

/**
 * Delete a receipt
 */
export async function deleteReceipt(receiptId: string, userId: string): Promise<void> {
  try {
    // Get receipt to find cloud URL
    const { data: receipt } = await supabase
      .from('receipts')
      .select('cloud_url')
      .eq('id', receiptId)
      .eq('user_id', userId)
      .single();

    // Delete from storage if exists
    if (receipt?.cloud_url) {
      const filename = receipt.cloud_url.split('/').pop();
      if (filename) {
        await supabase.storage.from('receipts').remove([`receipts/${userId}/${filename}`]);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
}
