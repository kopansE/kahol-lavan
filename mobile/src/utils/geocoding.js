export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'he,en',
        },
      }
    );
    const data = await response.json();

    if (data.address) {
      const { road, house_number, suburb, city } = data.address;
      let addressParts = [];

      if (road) {
        addressParts.push(road);
      }
      if (house_number) {
        addressParts.push(house_number);
      }
      if (suburb && suburb !== city) {
        addressParts.push(suburb);
      }
      if (city) {
        addressParts.push(city);
      }

      return addressParts.join(', ') || data.display_name;
    }

    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
};
