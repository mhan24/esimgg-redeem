import { expect, it } from 'vitest';
import { parseSiteSettings } from '@/lib/site-settings';
const settings = { redemptionPaused: false, pauseReason: '', purchaseUrl: 'https://shop.example.com', disclaimer: '站点说明' };
it('accepts the Telegram direct customer support link', () => {
  expect(parseSiteSettings({ ...settings, supportUrl: ' https://t.me/setup0de?direct ' }).supportUrl).toBe('https://t.me/setup0de?direct');
});
it.each(['javascript:alert(1)', 'data:text/html,hello', 'https://user:password@example.com', 'not-a-url'])('rejects unsafe or invalid customer support URL %s', supportUrl => {
  expect(() => parseSiteSettings({ ...settings, supportUrl })).toThrow();
});
it('preserves existing support settings when an older form omits the field', () => {
  expect(parseSiteSettings(settings)).not.toHaveProperty('supportUrl');
});
it('allows explicitly hiding the support link', () => {
  expect(parseSiteSettings({ ...settings, supportUrl: ' ' }).supportUrl).toBe('');
});
