export type ReverseAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  hamlet?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  city_district?: string;
  state_district?: string;
  state?: string;
  region?: string;
  country?: string;
};

function shorten(value: string) {
  return value
    .replace(/\s+(Sadar Subdistrict|Subdistrict|District|Division|County|Parish)$/i, "")
    .replace(/^Barishal$/i, "Barisal")
    .trim();
}

function locality(address: ReverseAddress) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.suburb ||
    address.hamlet ||
    address.neighbourhood ||
    ""
  );
}

function district(address: ReverseAddress) {
  return shorten(address.county || address.city_district || address.state_district || "");
}

function region(address: ReverseAddress) {
  return shorten(address.state || address.region || "");
}

export function formatClockLocation(address: ReverseAddress) {
  const city = locality(address);
  const area = district(address) || city;
  const house = address.house_number && address.house_number !== address.postcode ? address.house_number : "";
  const parts = [
    house,
    address.road,
    address.postcode,
    city,
    area,
    region(address),
    address.country,
  ]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean);

  const unique: string[] = [];
  for (const part of parts) {
    const previous = unique[unique.length - 1];
    if (previous && previous.toLowerCase() === part.toLowerCase() && part.toLowerCase() !== city.toLowerCase()) {
      continue;
    }
    unique.push(part);
  }
  return unique.join(", ");
}
