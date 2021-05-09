# Astro Mosaic Telescope Planner

Astro Mosaic is a tool for planning telescope observations. It shows a visual view of the target using a selected telescope, 
visibility during night and it can calculate mosaic coordinates. There are predefined telescope settings for 
some remote telescope services. 

AstroMosaic tool includes 
- Visual view of target using Aladin Sky Atlas
- Target name resolution using Sesame interface
- Field of View (FoV) view of target with a chosen telescope
- View and calculate mosaic coordinates up to 10x10 size
- Target visibility during the night
- Moon altitude and distance from the target
- Target and moon altitude over next 12 months
- Catalog lists for selecting the target
- Filtering of catalog list based on altitude, time and distance from the moon
- Multiple target coordinate formats are supported:
    HH:MM:SS DD:MM:SS, HH MM SS DD MM SS, 
    HH:MM:SS/DD:MM:SS, HH MM SS/DD MM SS,
    HHMMSS DDMMSS, HH.dec DD.dec
- A comma separated list can be given to show multiple targets
- Wiki interface to show target information

More details can be found at https://ruuth.xyz/AstroMosaicInfo.html.

AstroMosaic can also be embedded in a page by calling Javascript function or inside an Iframe.
More details can be found at https://ruuth.xyz/AstroMosaicConfigurationInfo.html.
