window.CATALOG_CATEGORIES = [
  { slug: "demo-products", label: "Тестовые товары" }
];
window.CATALOG_EU_CATEGORY_COUNTS = { "demo-products": 1 };
if (!window.CATALOG_PRODUCTS) window.CATALOG_PRODUCTS = [];
window.CATALOG_APPLICATION_PASSENGER_CARS = "Тестовое применение";
window.CATALOG_APPLICATION_COMMERCIAL_VEHICLE = "Тестовое применение";
window.CATALOG_APPLICATION_INDUSTRIAL = "Тестовое применение";
function normalizeCatalogDisplayText(str) {
  if (str == null) return str;
  return String(str).replace(/Â®/g, "").replace(/®/g, "").replace(/Â/g, "");
}
window.normalizeCatalogDisplayText = normalizeCatalogDisplayText;
