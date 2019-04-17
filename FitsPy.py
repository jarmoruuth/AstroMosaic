# This tool needs Python 3
# Other requirements:
#   NumPy - pip install numpy
#   AstroPy - pip install astropy --no-deps

import glob
import os
import sys
from astropy.io import fits

if len(sys.argv) < 2:
    print ("Usage: python fitspy.py {list|move|header} [file]")
    print ("  list - list some interesting FITS header info")
    print ("  move - move files to XRESxYRES directory, directory is created automatically")
    print ("  header - print all FITS heeader values")
    sys.exit()
if sys.argv[1] == 'list':
    if len(sys.argv) == 2:
        imgpath = "*.fit"
    else:
        imgpath = sys.argv[2]
    imgfiles = glob.glob(imgpath)
    imglist = []
    for img in imgfiles:
        hdul = fits.open(img)
        print (img + '  ' +
            str(hdul[0].header['NAXIS1']) + ' ' + 
            str(hdul[0].header['NAXIS2']) + ' ' +
            str(hdul[0].header['TELESCOP'])[10:12] + ' ' +
            str(hdul[0].header['FILTER']) + ' ' +
            #str(hdul[0].header['FOCALLEN']) + ' ' +
            #str(hdul[0].header['APTDIA']) + ' ' +
            '')
elif sys.argv[1] == 'move':
    if len(sys.argv) == 2:
        imgpath = "*.fit"
    else:
        imgpath = sys.argv[2]
    imgfiles = glob.glob(imgpath)
    imglist = []
    for img in imgfiles:
        hdul = fits.open(img)
        resol = str(hdul[0].header['NAXIS1']) + 'x' + str(hdul[0].header['NAXIS2'])
        hdul.close()
        if not os.path.exists(resol):
            print ('mkdir ' + resol)
            os.mkdir(resol)
        os.rename(img, resol+'\\'+img)
        print ('move ' + img + ' to ' + resol)        
elif sys.argv[1] == 'header':
    if len(sys.argv) == 2:
        imgpath = "*.fit"
    else:
        imgpath = sys.argv[2]
    imgfiles = glob.glob(imgpath)
    imglist = []
    for img in imgfiles:
        hdul = fits.open(img)
        k = list(hdul[0].header.keys())
        for x in k:
            print (x + '=' + str(hdul[0].header[x]))
else:
    print ("Bad argument " + str(sys.argv[1]))
    print ("Usage: python fitspy.py {list|move|header} [file]")
    sys.exit()
