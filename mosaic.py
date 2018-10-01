import sys
import math

aladin = 1

# T1 FOV 37´
# T2 wide field FOV 43'
# T3 FOV 1.654° x 1.249°
# T4 FOV 0° 15' 57" x 0° 12' 03"
# C1 FOV 0° 31' 18" x 0° 20' 51"

show_help = 1
if len(sys.argv) == 7:
    # RA/DEC
    show_help = 0
elif len(sys.argv) == 8:
    # RA/DEC + name
    show_help = 0
elif len(sys.argv) == 9:
    # RA/DEC + name + telescope
    show_help = 0
elif len(sys.argv) == 11:
    # RA/DEC + name + telescope + fov_x + fov_y
    show_help = 0
elif len(sys.argv) == 14:
    # RA/DEC + name + telescope + fov + size + zoom + img_source
    show_help = 0
else:
    show_help = 1

# size means number of panels on each side
# 1 gives 3x3
# 2 gives 4x4
size = 1

name = "mosaic"
telescope = "T1"
fov_x = 37
fov_y = 37
img_fov = 0.8
img_size = 300
img_zoom = "6"
img_source = "DSS2"

fov_x = float(fov_x)*float(60)/float(3600)
fov_y = float(fov_y)*float(60)/float(3600)

if show_help:
    print ("")
    if aladin == 1:
        print ("Usage: mosaic.py RA DEC [name] [Telescope] [FOV_x FOV_y] [size]")
    else:
        print ("Usage: mosaic.py RA DEC [name] [Telescope] [FOV_x FOV_y] [size zoom img_source]")
    print ("")
    print ("Program creates 3x3 mosaic coordinates from a given middle coordinates.")
    print ("")
    print ("Coordinates are printed on screen and also a <name>.html file is created")
    print ("that will open approximate images of each panel in a mosaic.")
    print ("")
    if aladin == 1:
        print ("Panel images are from https://aladin.u-strasbg.fr/")
    else:
        print ("Panel images are from sky-map.org. Parameters size and zoom can be")
        print ("used to give a better approximation of the FOV. Possible img_sources are at")
        print ("least SDSS and DSS2.")
    print ("")
    print ("Built in telescope names are Slooh.com T1, T2, T3, T4 and C1 which will")
    print ("set rest of parameters automatically (unless they are given on a command line).")
    print ("")
    print ("Images are overlapped by 10%.")
    print ("")
    print ("Parameters:")
    print ("RA          hour minute seconds")
    print ("DEC         degrees minute seconds")
    print ("name        Optional object name, generates name.html file, default " + name)
    print ("Telescope   Optional telescope name, default " + telescope)
    print ("FOV         Optional image FOV in degrees, default " + str(round(fov_x, 2)) + " " + str(round(fov_y, 2)))
    print ("size        Optional image size, default " + str(img_size))
    if aladin != 1:
        print ("zoom        Optional image zoom, default " + img_zoom)
        print ("img_source  Optional image source, default " + img_source)
    sys.exit()

if len(sys.argv) > 7:
    name = sys.argv[7]

if len(sys.argv) > 8:
    telescope = sys.argv[8]
    if telescope == "T1":
        fov_x = float(33)*float(60)/float(3600)
        fov_y = float(33)*float(60)/float(3600)
    if telescope == "T2":
        fov_x = float(43)*float(60)/float(3600)
        fov_y = float(43)*float(60)/float(3600)
    if telescope == "T3":
        fov_x = 1.654
        fov_y = 1.249
        img_zoom = "5"
    if telescope == "T4":
        fov_x = (float(15)*float(60)+57)/float(3600)
        fov_y = (float(12)*float(60)+3)/float(3600)
    if telescope == "C1":
        fov_x = (float(31)*float(60)+18)/float(3600)
        fov_y = (float(20)*float(60)+51)/float(3600)

if len(sys.argv) > 10:
    fov_x = int(sys.argv[9])
    fov_y = int(sys.argv[10])

if len(sys.argv) == 14:
    img_size = int(sys.argv[11])
    img_zoom = sys.argv[12]
    img_source = sys.argv[13]

ra = abs(float(sys.argv[1])) + (float(sys.argv[2]) * 60 + float(sys.argv[3])) / 3600
# convert from hours to degrees
ra = ra * 15
if float(sys.argv[1]) < 0:
    ra = -ra
dec = abs(float(sys.argv[4])) + (float(sys.argv[5]) * 60 + float(sys.argv[6])) / 3600
if float(sys.argv[4]) < 0:
    dec = -dec

mosaic = []

i = 0
row = size
while row >= -size:
    row_dec = dec + row * img_fov * fov_y
    col = size
    while col >= -size:
        col_ra = ra + col * (img_fov * fov_x * (1/math.cos(math.radians(abs(row_dec)))))
        # convert from degrees to hours
        col_ra = col_ra / 15
        point = []
        point.append(col_ra)
        point.append(row_dec)
        mosaic.append(point)
        col = col - 1
        i = i + 1 
    row = row - 1

print (name, telescope)
print ("RA/DEC decimal hh.dec/deg.dec")
i = 0
row = size
while row >= -size:
    col = size
    while col >= -size:
        point = mosaic[i]
        print (i, '{0:.5f}'.format(point[0]), "/", '{0:.5f}'.format(point[1]))
        col = col - 1
        i = i + 1 
    row = row - 1
    print ("")

print ("RA/DEC hh:mm:ss/deg:hh:mm")
i = 0
aladin_target = []
row = size
while row >= -size:
    col = size
    while col >= -size:
        point = mosaic[i]
        point_ra = point[0]
        point_dec = point[1]

        point_ra_hour = int(point_ra)
        point_ra_sec = (abs(point_ra) - abs(point_ra_hour)) * 3600
        point_ra_min = int(point_ra_sec / 60)
        point_ra_sec = point_ra_sec - point_ra_min * 60

        point_dec_hour = int(point_dec)
        point_dec_sec = (abs(point_dec) - abs(point_dec_hour)) * 3600
        point_dec_min = int(point_dec_sec / 60)
        point_dec_sec = point_dec_sec - point_dec_min * 60

        aladin_target_str = str(point_ra_hour) + ":" + str(point_ra_min) + ":" + str(round(point_ra_sec, 2)) + " "
        aladin_target_str = aladin_target_str + str(point_dec_hour) + ":" + str(point_dec_min) + ":" + str(round(point_dec_sec, 2))
        aladin_target.append(aladin_target_str)
        
        print (i, str(point_ra_hour).rjust(2), str(point_ra_min).rjust(2), '{0:.1f}'.format(point_ra_sec), "/",
                  str(point_dec_hour).rjust(2), str(point_dec_min).rjust(2), '{0:.1f}'.format(point_dec_sec))
        col = col - 1
        i = i + 1 
    row = row - 1
    print ("")

f = open(name + '.html', 'w')

f.write("<!DOCTYPE HTML>\n")
f.write("<html lang = \"en\">\n")
f.write("<head>\n")
if aladin == 1:
    f.write("<!-- include Aladin Lite CSS file in the head section of your page -->\n")
    f.write("<link rel=\"stylesheet\" href=\"http://aladin.u-strasbg.fr/AladinLite/api/v2/latest/aladin.min.css\" />\n")
f.write("<style>\n")
f.write(".flex-container {\n")
f.write("  display: flex;\n")
f.write("  flex-direction: row;\n")
f.write("}\n")
f.write(".flex-container > div {\n")
f.write("  margin: 5px;\n")
f.write("  padding: 5px;\n")
f.write("  font-size: 20px;\n")
f.write("}\n")
f.write("</style>\n")
f.write("    <title>" + name + " " + telescope + "</title>\n")
f.write("    <meta charset = \"UTF-8\" />\n")
f.write("</head>\n")
f.write("<body>\n")
if aladin == 1:
    f.write("<!-- you can skip the following line if your page already integrates the jQuery library -->\n")
    f.write("<script type=\"text/javascript\" src=\"http://code.jquery.com/jquery-1.12.1.min.js\" charset=\"utf-8\"></script>\n")
    f.write("<script type=\"text/javascript\" src=\"http://aladin.u-strasbg.fr/AladinLite/api/v2/latest/aladin.min.js\" charset=\"utf-8\"></script>\n")
f.write("<h1>" + name + " " + telescope + "</h1>\n")
f.write("<p>\n")
if aladin == 1:
    f.write(" Images from https://aladin.u-strasbg.fr/\n")
else:
    f.write(" Images from http://www.sky-map.org/\n")
f.write("<br>\n")

# Print command line for easy rerun
cmdline = ""
for x in sys.argv[1:]:
    cmdline = cmdline + x + " "
f.write("Command line: " + cmdline + "\n")
f.write("</p>\n")

i = 0
row = size
while row >= -size:
    col = size
    f.write("<div class=\"flex-container\">\n")
    while col >= -size:
        point = mosaic[i]
        f.write("<div>\n")
        if aladin == 1:
            f.write("<!-- insert this snippet where you want Aladin Lite viewer to appear and after the loading of jQuery -->\n")
            f.write("<div id=\"aladin-lite-div-"+str(i)+"\" style=\"width:"+str(img_size)+"px;height:"+str(int(img_size*(fov_y/fov_x)))+"px;\"></div>\n")
        else:
            iframe = "<IFRAME SRC=\"http://server1.sky-map.org/skywindow?ra="
            iframe = iframe + str(point[0])
            iframe = iframe + "&de="
            iframe = iframe + str(point[1])
            iframe = iframe + "&zoom="+img_zoom+"&&img_source="+img_source+"\" \n"
            iframe = iframe + "WIDTH="+str(img_size)+" HEIGHT="+str(int(img_size*(fov_y/fov_x)))+">\n"
            f.write(iframe)
            f.write("</iframe>\n")
        f.write("<br>\n")
        f.write("<small>" + str(i+1) + " RA/DEC:" + str(round(point[0], 5)) + "/" + str(round(point[1], 5)) + "</small>\n")
        f.write("</div>\n")
        col = col - 1
        i = i + 1 
    row = row - 1
    f.write("</div>\n")


if aladin == 1:
    i = 0
    while i < len(aladin_target):
        f.write("<script type=\"text/javascript\">\n")
        aladinstr = "    var aladin = A.aladin("
        aladinstr = aladinstr + "'#aladin-lite-div-"+str(i)+"', "
        aladinstr = aladinstr + "{survey: \"P/DSS2/color\", "
        aladinstr = aladinstr + "fov:"+str(round(fov_x, 4))+", "
        aladinstr = aladinstr + "target: \"" + aladin_target[i] + "\","
        aladinstr = aladinstr + "showReticle:false, showZoomControl:false, "
        aladinstr = aladinstr + "showFullscreenControl:false, showLayersControl:false, "
        aladinstr = aladinstr + "showGotoControl:false"
        aladinstr = aladinstr + "});\n"
        f.write(aladinstr)
        f.write("</script>\n")
        i = i + 1

f.write("</body>\n")
f.write("</html>\n")

print ('Mosaic images in file ' + name + '.html')
f.close()
