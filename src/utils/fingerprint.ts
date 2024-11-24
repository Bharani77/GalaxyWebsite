import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFingerprint: string | null = null;

export const getDeviceFingerprint = async (): Promise<string> => {
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  try {
    // Initialize an agent at application startup.
    const fp = await FingerprintJS.load();

    // Get the visitor identifier when you need it.
    const result = await fp.get();

    // This is the visitor identifier:
    cachedFingerprint = result.visitorId;
    return cachedFingerprint;
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    throw new Error('Failed to generate device fingerprint');
  }
};
