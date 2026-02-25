'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AttachedImage, ImageUploadResponse } from '@/types/chat';
import { useAuthStore } from '@/stores/useAuthStore';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function useImageUpload(roomId: string) {
  const [images, setImages] = useState<AttachedImage[]>([]);
  const xhrMapRef = useRef<Map<string, XMLHttpRequest>>(new Map());

  const updateImage = useCallback(
    (id: string, updates: Partial<AttachedImage>) => {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
      );
    },
    []
  );

  const uploadImage = useCallback(
    async (image: AttachedImage) => {
      const xhr = new XMLHttpRequest();
      xhrMapRef.current.set(image.id, xhr);

      updateImage(image.id, { status: 'uploading', progress: 0 });

      const formData = new FormData();
      formData.append('file', image.file);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          updateImage(image.id, { progress });
        }
      };

      xhr.onload = () => {
        xhrMapRef.current.delete(image.id);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response: ImageUploadResponse = JSON.parse(xhr.responseText);
            updateImage(image.id, {
              status: 'done',
              uploadedUrl: response.url,
              progress: 100,
            });
          } catch {
            updateImage(image.id, { status: 'error' });
          }
        } else {
          updateImage(image.id, { status: 'error' });
        }
      };

      xhr.onerror = () => {
        xhrMapRef.current.delete(image.id);
        updateImage(image.id, { status: 'error' });
      };

      xhr.open('POST', `/api/rooms/${roomId}/images`);

      const token = await useAuthStore.getState().getIdToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);
    },
    [roomId, updateImage]
  );

  const addImages = useCallback(
    (files: File[]) => {
      setImages((prev) => {
        const remaining = MAX_IMAGES - prev.length;
        if (remaining <= 0) {
          console.warn(`Maximum ${MAX_IMAGES} images allowed`);
          return prev;
        }

        const validFiles: File[] = [];
        for (const file of files) {
          if (file.size > MAX_FILE_SIZE) {
            console.warn(`File ${file.name} exceeds 10MB limit`);
            continue;
          }
          if (!ALLOWED_TYPES.includes(file.type)) {
            console.warn(`File ${file.name} has invalid type: ${file.type}`);
            continue;
          }
          validFiles.push(file);
          if (validFiles.length >= remaining) break;
        }

        if (validFiles.length === 0) return prev;

        const newImages: AttachedImage[] = validFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'pending' as const,
          progress: 0,
        }));

        // Start uploads after state update
        queueMicrotask(() => {
          newImages.forEach((image) => uploadImage(image));
        });

        return [...prev, ...newImages];
      });
    },
    [uploadImage]
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
        const xhr = xhrMapRef.current.get(id);
        if (xhr) {
          xhr.abort();
          xhrMapRef.current.delete(id);
        }
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const clearImages = useCallback(() => {
    setImages((prev) => {
      prev.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    xhrMapRef.current.forEach((xhr) => xhr.abort());
    xhrMapRef.current.clear();
  }, []);

  const isUploading = images.some(
    (img) => img.status === 'uploading' || img.status === 'pending'
  );

  const uploadedUrls = images
    .filter((img) => img.status === 'done' && img.uploadedUrl)
    .map((img) => img.uploadedUrl!);

  // Cleanup on unmount
  useEffect(() => {
    const currentXhrMap = xhrMapRef.current;
    return () => {
      currentXhrMap.forEach((xhr) => xhr.abort());
      currentXhrMap.clear();
    };
  }, []);

  return {
    images,
    addImages,
    removeImage,
    clearImages,
    isUploading,
    uploadedUrls,
  };
}
