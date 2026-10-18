# Third-party data and attribution

The MIT license covers the original software and documentation. Bundling or
rendering third-party geographic data does not relicense that data. The standalone
HTML contains application code and embedded assets with the following origins.

## Natural Earth

**Public domain.** Coastline polygons and Natural Earth II imagery are used in
`work/land-10m.geojson`, the `land` part of `work/route-studio/dist/data.js`, the
`relief` part of `backgrounds.js`, the standalone HTML and rendered examples.
The coastline is clipped to East Asia; raster imagery is projected to Mercator.

- [Terms of use](https://www.naturalearthdata.com/about/terms-of-use/)
- [Natural Earth II source](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-2/)
- Credit: Made with Natural Earth. Authors include Tom Patterson, Nathaniel Vaughn Kelso and contributors.

## NASA Blue Marble: Next Generation

NASA Earth Observatory, **June 2004**, with topography and bathymetry. Used in the
`satellite` part of `backgrounds.js`, the standalone HTML and related examples.
The global raster is cropped and reprojected. It is a dated composite, not imagery
from the voyages' recording dates.

- [Source imagery](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/)
- [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
- Credit: Background imagery: NASA Earth Observatory / Blue Marble Next Generation (2004).

NASA media are generally not subject to copyright in the United States, subject to
the linked guidelines and any identified third-party rights. NASA names and logos
are not licensed by this project's MIT license; no endorsement is implied.

## EOX Sentinel-2 cloudless 2016

**Creative Commons Attribution 4.0 International (CC BY 4.0).** The online imagery
uses the `s2cloudless_3857` 2016 layer, not the differently licensed newer layers.
Affected files include `work/eox-test-z14.jpg`, `outputs/Ishigaki_Satellite_HD_4K.png`,
`docs/assets/ishigaki-satellite.jpg`, and imagery fetched at runtime by `highres.js`.
Images are cropped, resampled and combined with route/label overlays; the README
preview is also resized. These derived images retain the imagery attribution.

> EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH
> (Contains modified Copernicus Sentinel data 2016), CC BY 4.0.

- [License](https://creativecommons.org/licenses/by/4.0/)
- [EOX licensing by imagery year](https://cloudless.eox.at/pricing)
- [Service usage](https://cloudless.eox.at/documentation/usage)

Keep the EOX source credit in exported imagery or supply the required attribution
with a redistributed work. The app includes a small credit in high-resolution PNGs
and linked credit in its interface. The public tile service has no availability guarantee.

## Other content

The Navionics-named preset refers only to a color reference supplied during design.
No Navionics chart tiles, bathymetric database or original reference screenshot are
included. GPX records are provided by Sailing Team Random Voyage; the bundle
contains the supplied voyage coordinates and timestamps.

Sharp and its transitive development dependencies retain their package licenses.
They are used for verification, not embedded in the app. System fonts are referenced
by name; font files are not redistributed.
