import parkingZones from "../assets/parking_zones.json";

/**
 * Checks if a point is inside a polygon using the ray-casting algorithm
 * @param {Array} point - [lat, lng]
 * @param {Array} polygon - Array of [lng, lat] coordinates (GeoJSON format)
 * @returns {boolean}
 */
function isPointInPolygon(point, polygon) {
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Determines which parking zone a coordinate belongs to
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object|null} - { zone: number, name: string, parking_type: string } or null if not in any zone
 */
export function getParkingZone(lat, lng) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  const point = [lat, lng];

  for (const feature of parkingZones.features) {
    if (feature.geometry.type === "Polygon") {
      const coordinates = feature.geometry.coordinates[0];

      if (isPointInPolygon(point, coordinates)) {
        return {
          zone: feature.properties.zone,
          name: feature.properties.name,
          parking_type: feature.properties.parking_type,
        };
      }
    }
  }

  return null; // Not in any parking zone
}

/**
 * Gets a formatted string for displaying parking zone
 * @param {number|null} zoneNumber - The parking zone number
 * @returns {string}
 */
export function formatParkingZone(zoneNumber) {
  if (!zoneNumber) {
    return "אזור לא ידוע";
  }
  return `אזור ${zoneNumber}`;
}

/**
 * Gets parking zone information by zone number
 * @param {number} zoneNumber - The parking zone number
 * @returns {Object|null}
 */
export function getParkingZoneInfo(zoneNumber) {
  if (!zoneNumber) return null;

  const feature = parkingZones.features.find(
    (f) => f.properties.zone === zoneNumber,
  );

  if (feature) {
    return {
      zone: feature.properties.zone,
      name: feature.properties.name,
      parking_type: feature.properties.parking_type,
    };
  }

  return null;
}
