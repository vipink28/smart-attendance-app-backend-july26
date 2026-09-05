/**
 * Calculates the great-circle distance between two lat/lng points using the
 * Haversine formula. Returns distance in meters.
 */
function getDistanceMeters(pointA, pointB) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);
  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

module.exports = { getDistanceMeters };
