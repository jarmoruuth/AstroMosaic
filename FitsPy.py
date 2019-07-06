# This tool needs Python 3
# Other requirements:
#   NumPy - pip install numpy
#   AstroPy - pip install astropy --no-deps

import glob
import os
import sys
from glob import iglob
from astropy.io import fits

if len(sys.argv) < 2:
    print ("Usage: python FitsPy.py {list|move|header|coordinates} [file]")
    print ("  list - list some interesting FITS header info")
    print ("  move - move files to XRESxYRES directory, directory is created automatically")
    print ("  header - print all FITS heeader values")
    print ("  coordinates - recursively find coordinates from FITS file names")
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
        target_file = resol+'\\'+img
        if not os.path.exists(target_file):
            os.rename(img, target_file)
            print ('move ' + img + ' to ' + resol)
        else:
            print ('file ' + img + ' already exists in ' + resol)
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
elif sys.argv[1] == 'coordinates':
    if len(sys.argv) == 2:
        globdir = "."
    else:
        globdir = sys.argv[2]
    rootdirs = glob.glob(globdir)
    coords = []
    for rootdir in rootdirs:
        if os.path.isdir(rootdir):
            file_list = [f for f in iglob(os.path.join(rootdir, '**/*.fit'), recursive=True) if os.path.isfile(f)]
            for file in file_list:
                fname = os.path.basename(file)
                if fname[0:1].isdigit():
                    coords.append(fname[0:13])
    coords = list(set(coords))
    for c in coords:
        if c[6:7] == 'm':
            sign = '-'
        else:
            sign = ''
        print(c[0:6] + ' ' + sign + c[7:] + ',', end='')
         
else:
    print ("Bad argument " + str(sys.argv[1]))
    print ("Usage: python fitspy.py {list|move|header|coordinates} [file]")
    sys.exit()
