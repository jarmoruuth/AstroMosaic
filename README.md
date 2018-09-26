# AstroMosaic

Python tool to calculate coordinates for astro image mosaics. When given 
a mosaic center position in command line the program calculates positions
for 3x3 tiles to create a mosaic image.

Coordinates are calculated so that images are overlapped by 10%.

Program also generates an HTML file that shows tiles based on images
at Aladin Sky Atlas.

Example to create a 3x3 mosaic panels from Horsehead nebula using
default T1 telescope settings.

  python mosaic.py 05 40 49.0 -02 27 30 Horsehead

After the command mosaic coordinates are printed on screen in two different 
formats and file Horsehead.html is generated to view the panel images.

Program help is shown below:

Usage: mosaic.py RA DEC [name] [Telescope] [FOV_x FOV_y] [size]

Program creates 3x3 mosaic coordinates from a given middle coordinates.

Coordinates are printed on screen and also a <name>.html file is created
that will open approximate images of each panel in a mosaic.

Panel images are from https://aladin.u-strasbg.fr/

Built in telescope names are Slooh.com T1, T2, T3, T4 and C1 which will
set rest of parameters automatically (unless they are given on a command line).

Images are overlapped by 10%.

Parameters:

RA          
hour minute seconds

DEC         
degrees minute seconds

name        
Optional object name, generates name.html file, default mosaic

Telescope   
Optional telescope name, default T1

FOV         
Optional image FOV in degrees, default 0.62 0.62

size        
Optional image size, default 300
