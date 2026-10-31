export function haversine(a, b) {
  const rad = (value) => Number(value) * Math.PI / 180;
  const dLat = rad(b.lat) - rad(a.lat);
  const dLon = rad(b.lon) - rad(a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function formatDistance(meters) {
  return meters < 1000
    ? { value: Math.round(meters).toLocaleString('ko-KR'), unit: 'm' }
    : { value: (meters / 1000).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), unit: 'km' };
}
