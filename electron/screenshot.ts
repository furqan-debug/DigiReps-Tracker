import { desktopCapturer } from 'electron';

/**
 * Captures the primary screen as a Base64-encoded PNG string.
 * This can be sent to the backend for storage as proof of work.
 */
export async function captureScreenBase64(): Promise<string | null> {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        if (sources && sources.length > 0) {
            // sources[0] is typically the primary display.
            // We can grab the thumbnail which is a NativeImage object
            const image = sources[0].thumbnail;

            // We convert it to a data URL (e.g., data:image/png;base64,...)
            return image.toDataURL();
        }
        return null;
    } catch (err) {
        console.error('Failed to capture screen:', err);
        return null;
    }
}
