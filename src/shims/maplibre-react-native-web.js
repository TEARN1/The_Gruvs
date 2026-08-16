/**
 * Web stub for @maplibre/maplibre-react-native.
 *
 * The native map lives behind `if (Platform.OS !== 'web')` in LiveMap, so this
 * is never rendered on web — but Metro walks EVERY require() in the module
 * graph, including ones in branches that are dead for the target platform, and
 * the real package's module layout does not resolve for web ("Unable to resolve
 * ./components/camera/Camera.js"). That failure takes down the whole web
 * bundle, not just the map.
 *
 * Same reason and same pattern as react-native-maps-web.js / -svg / -qrcode:
 * alias it to a stub in metro.config.js for platform === 'web'.
 *
 * Web uses maplibre-gl (the browser library) directly instead — see LiveMap.
 */
const Noop = () => null;

export const MapView = Noop;
export const Camera = Noop;
export const ShapeSource = Noop;
export const CircleLayer = Noop;
export const HeatmapLayer = Noop;
export const FillLayer = Noop;
export const LineLayer = Noop;
export const SymbolLayer = Noop;
export const Marker = Noop;
export const ViewAnnotation = Noop;
export const UserLocation = Noop;
export const Images = Noop;
export const ImageSource = Noop;
export const RasterSource = Noop;
export const VectorSource = Noop;

export default { MapView, Camera, ShapeSource, CircleLayer, HeatmapLayer, FillLayer, LineLayer };
