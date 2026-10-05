// Robust client-side media download.
// Cloudinary's attachment transformation is placed in the delivery path,
// avoiding CORS/blob-fetch problems on deployed sites.
function withCloudinaryAttachment(url, filename) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('res.cloudinary.com')) return null;
    const safeName = (filename || 'ra-social-media')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 80);
    if (u.pathname.includes('/upload/')) {
      u.pathname = u.pathname.replace('/upload/', `/upload/fl_attachment:${safeName}/`);
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export async function downloadMedia(url, filename, fallbackUrl = null) {
  if (!url) return { success: false, error: 'No media to download' };

  const attachmentUrl = withCloudinaryAttachment(url, filename);
  if (attachmentUrl) {
    const link = document.createElement('a');
    link.href = attachmentUrl;
    link.download = filename || 'ra-social-media';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { success: true };
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'ra-social-media';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    return { success: true };
  } catch (error) {
    window.open(fallbackUrl || url, '_blank', 'noopener,noreferrer');
    return { success: false, error: error.message };
  }
}
