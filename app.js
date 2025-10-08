document.addEventListener("DOMContentLoaded", () => {
  const coordsEl = document.getElementById("coords");

  // Initialize map
  const map = L.map("map", {
    zoomControl: true,
  });

  // Default view (Tel Aviv as a starting point)
  const defaultCenter = [32.0853, 34.7818];
  map.setView(defaultCenter, 12);

  // Tile layer (OpenStreetMap)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  let marker = null;

  function updateCoordsDisplay(latlng) {
    const lat = latlng.lat.toFixed(6);
    const lng = latlng.lng.toFixed(6);
    coordsEl.textContent = `Latitude: ${lat}, Longitude: ${lng}`;
  }

  map.on("click", (e) => {
    const { latlng } = e;
    if (marker) {
      marker.setLatLng(latlng);
    } else {
      marker = L.marker(latlng, { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const newPos = marker.getLatLng();
        updateCoordsDisplay(newPos);
      });
    }
    updateCoordsDisplay(latlng);
  });

  // Try to center map on user location if available
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLatLng = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        map.setView(userLatLng, 14);
      },
      () => {
        // Ignore errors; keep default center
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }
});
