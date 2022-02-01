/*************************************************************************\
 * 
 *      AstroMosaic telescope planner engine. (C) Jarmo Ruuth, 2018-2021
 *
 * An embeddable JavaScript file of AstroMosaic engine. 
 * It can show:
 *      - Target with telescope field of view using Aladin Lite
 *      - Target day visibility graphs
 *      - Target year visibility graphs
 * 
\*************************************************************************/

/*************************************************************************
 * 
 *      AstroMosaicEngine
 * 
 * AstroMosaic entry point for embedded Javascript.
 * 
 * Notes:
 * - If calling AstroMosaicEngine multiple times Aladin view may show
 *   multiple views. This can be solved by setting AstroMosaicEngine
 *   return object to null before calling it again.
 * 
 * Parameters:
 *
 *      target
 *          Image target as a name, coordinates or a comma 
 *          Separated list of coordinates.
 *
 *      params
 *          Parameters in JSON format for showing the requested view
 *          or views.
 *          {
 *              fov_x            : x fov in degrees,
 *              fov_y            : y fov in degrees,
 *              location_lat     : location latitude,
 *              location_lng     : location longitude,
 *              horizonSoft      : soft horizon limit or null,
 *              horizonHard      : hard horizon limit or null,
 *              meridian_transit : meridian transit or null,
 *              UTCdate_ms       : start of day UTC date in milliseconds 
 *                                 or null for current day,
 *              timezoneOffset   : difference between UTC time and local time, in hours,
 *                                 null for UTC, should match with lat/lng
 *              isCustomMode     : true to use custom colors, false otherwise
 *                                 if true, all custom colors below must be given,
 *              chartTextColor   : custom chart text color,
 *              gridlinesColor   : custom chart grid lines color,
 *              backgroundColor  : custom chart background color
 *         }
 *
 *      target_div
 *            Div section name for showing the target view, or null.
 *
 *      day_div
 *            Div section name for showing the day visibility view, or null.
 *
 *      year_div
 *            Div section name for showing the year visibility view, or null.
 *
 * Requirements:
 *
 *      Aladin Lite needs the following CSS to be loaded::
 *      <link rel="stylesheet" href="https://aladin.u-strasbg.fr/AladinLite/api/v2/latest/aladin.min.css" / >
 *
 *      Aladin Lite needs the following scripts to be loaded:
 *      <script type="text/javascript" src="https://code.jquery.com/jquery-1.12.1.min.js" charset="utf-8">< /script>
 *      <script type="text/javascript" src="https://aladin.u-strasbg.fr/AladinLite/api/v2/latest/aladin.min.js" charset="utf-8">< /script>
 *
 *      Google Charts needs the following script to be loaded:
 *      <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js">< /script>
 * 
 * Example:
 * 
 *  AstroMosaicEngine("horsehead nebula", params, "target-div", "day-div", "year-div");
 */
function AstroMosaicEngine(target, params, target_div, day_div, year_div)
{
    console.log('AstroMosaicEngine');

    var engine_params = {
        fov_x : getAstroMosaicFov(params.fov_x),
        fov_y : getAstroMosaicFov(params.fov_y),
        location_lat : params.location_lat,
        location_lng : params.location_lng,
        horizonSoft : params.horizonSoft,
        horizonHard : params.horizonHard,
        meridian_transit : params.meridian_transit,
        UTCdate_ms : params.UTCdate_ms,
        timezoneOffset : params.timezoneOffset,
        grid_type : "fov",
        grid_size_x : 1,
        grid_size_y : 1,
        isCustomMode : params.isCustomMode,
        chartTextColor : params.chartTextColor,
        gridlinesColor : params.gridlinesColor,
        backgroundColor : params.backgroundColor
    };

    var engine_panels = {
        aladin_panel : target_div,
        aladin_panel_text : null,
        dayvisibility_panel : day_div,
        dayvisibility_panel_text : null,
        yearvisibility_panel : year_div,
        yearvisibility_panel_text : null,
        status_text : null,
        error_text : null,
        panel_view_x : null,
        panel_view_y : null,
        panel_view_div : null,
        panel_view_text : null
    };

    if (engine_params.horizonSoft != null && engine_params.horizonHard == null) {
        // we have only soft horizon, use it as hard horizon
        console.log('AstroMosaicEngine, use soft horizon as hard horizon');
        engine_params.horizonHard = engine_params.horizonSoft;
        engine_params.horizonSoft = null;
    }
    if (engine_params.horizonSoft != null) {
        engine_params.horizonSoft = fillHorizonLimits(engine_params.horizonSoft);
    }
    engine_params.horizonHard = fillHorizonLimits(engine_params.horizonHard);

    if (engine_params.UTCdate_ms == null) {
        // Use current date
        var d = new Date();
        var year = d.getUTCFullYear();
        var month = d.getUTCMonth();
        var day = d.getUTCDate();
        engine_params.UTCdate_ms = Date.UTC(year, month, day, 0, 0, 0, 0);
    }

    return StartAstroMosaicViewerEngine("", target, engine_params, engine_panels, null, 20, null);
}

/* 
 * Utility routine to convert FoV degrees to format used by StartAstroMosaicViewerEngine.
 */
function getAstroMosaicFov(fov)
{
    return (fov*60.0)/3600.0;
}

/* 
 * Ensure that we have horizon limits fov every 5 arcminutes.
 */
function fillHorizonLimits(horizon_limits)
{
    if (horizon_limits == null || horizon_limits.length == 0) {
        horizon_limits = [0];
    }
    var len = horizon_limits.length;
    if (len < 71) {
        // we need limit for every 5 arcminutes
        var last = horizon_limits[len-1];
        for (var k = len; k < 71; k++) {
            horizon_limits[k] = last;
        }
    }
    return horizon_limits;
}

/*************************************************************************
 *
 *      StartAstroMosaicViewerEngine
 * 
 * Interface for the native viewer.
 *
 * Parameters:
 *
 *      img_fov - field of view for single image considering the overlap
 */
function StartAstroMosaicViewerEngine(
    engine_view_type, 
    target, 
    engine_params, 
    engine_panels, 
    engine_catalogs, 
    img_fov,
    engine_native_resources)
{
    var resolved_name = null;
    var resolved_coordinates = null;

    var target_ra;
    var target_dec;
    var grid_type = engine_params.grid_type;

    var hour_ms = 60*60*1000;
    var day_ms = 24*hour_ms;
    var degToRad = Math.PI/180.0;
    var radToDeg = 180.0/Math.PI;
    var degToHours = 1/15;
    var hoursToDeg = 15;
    var JD1970 = 2440587.5;     // JD 1970-01-01 00:00 - Javascript zero time

    var engine_data = {
        aladin : null,
        aladinarr : [],
        daydata : null,
        daychart : null,
        yeardata : null,
        yearchart : null

    };
    var aladin_fov_extra = 1;

    var image_target;
    var image_target_list = [];

    var engine_error_text = null;

    console.log('StartAstroMosaicViewerEngine', engine_view_type, target);
    console.log('timezoneOffset', engine_params.timezoneOffset);

    if (engine_native_resources) {
        engine_native_resources.sun_rise_set = sun_rise_set;
        engine_native_resources.object_altitude_init = object_altitude_init;
        engine_native_resources.object_altaz = object_altaz;
        engine_native_resources.object_altitude_get = object_altitude_get;
        engine_native_resources.moon_position = moon_position;
        engine_native_resources.moon_topocentric_correction = moon_topocentric_correction;
        engine_native_resources.moon_distance = moon_distance;
    }

    image_target = target;
    image_target_list = [];
    img_fov = 1 - img_fov / 100;

    var c = image_target.substr(0,1);
    if ((c >= '0' && c <= '9') || c == '-' || c == '+') {
        console.log('image_target is number');
        image_target_list = image_target.split(',');
        for (var i = 0; i < image_target_list.length; i++) {
            image_target_list[i] = reformat_coordinates(image_target_list[i]);
        }
        console.log('image_target_list', image_target_list);
        image_target = image_target_list[0];
        EngineViewImageByType();
    } else {
        console.log('image_target is name');
        // try to resolve target as a name
        EngineViewImageByName();
    }
    return engine_data;

    function degrees_to_radians(degrees)
    {
        var pi = Math.PI;
        return degrees * (pi/180);
    }

    // convert image_target HH:MM:SS DEG:HH:MM to decimal degrees
    function get_ra_dec(target)
    {
        var radec = [];

        // assume format HH:MM:SS DEG:HH:MM
        var radec = target.split(' ');
        
        var raparts = radec[0].split(':');
        var decparts = radec[1].split(':');

        radec[0] = Math.abs(parseFloat(raparts[0])) + (parseFloat(raparts[1]) * 60 + parseFloat(raparts[2])) / 3600;
        if (isNaN(radec[0])) {
            // assume seconds are missing
            radec[0] = Math.abs(parseFloat(raparts[0])) + (parseFloat(raparts[1]) * 60) / 3600;
        }
        if (isNaN(radec[0])) {
            // assume minutes are missing
            radec[0] = Math.abs(parseFloat(raparts[0]));
        }
        if (isNaN(radec[0])) {
            return [];
        }
        // convert from hours to degrees
        radec[0] = radec[0] * hoursToDeg;
        if (parseFloat(raparts[0]) < 0) {
            radec[0] = -radec[0];
        }
        radec[1] = Math.abs(parseFloat(decparts[0])) + (parseFloat(decparts[1]) * 60 + parseFloat(decparts[2])) / 3600;
        if (isNaN(radec[1])) {
            // assume seconds are missing
            radec[1] = Math.abs(parseFloat(decparts[0])) + (parseFloat(decparts[1]) * 60) / 3600;
        }
        if (isNaN(radec[1])) {
            // assume minutes are missing
            radec[1] = Math.abs(parseFloat(decparts[0]));
        }
        if (isNaN(radec[1])) {
            return [];
        }
        if (parseFloat(decparts[0]) < 0) {
            radec[1] = -radec[1];
        }
        return radec;
    }

    // convert image_target HH:MM:SS DEG:HH:MM to decimal degrees into target_ra and target_dec
    function get_image_target_ra_dec()
    {
        var radec = get_ra_dec(image_target);
        if (radec.length != 2) {
            return false;
        }
        target_ra = radec[0];
        target_dec = radec[1];

        return true;
    }

    // scale degrees to 0-360
    function scale_to_360(v)
    {
        while (v < 0) {
            v = v + 360;
        }
        return v - Math.floor(v/360)*360;
    }

    // sin from decimal degrees
    function sind(deg)
    {
        return Math.sin(deg*degToRad);
    }

    // cos from decimal degrees
    function cosd(deg)
    {
        return Math.cos(deg*degToRad);
    }

    // Julian Days from 2000, including fraction, used by sun and moon calculations
    function getJD(d)
    {
        var days = JD1970 + d / day_ms - 2451543.5;
        return days;
    }

    // Days from J2000, including fraction, used by altitude calculations
    function getJ2000_2(d)
    {
        var days = JD1970 + d / day_ms - 2451545.0;
        return days;
    }

    // Calculate object altitude. 
    // Useful links:
    //      https://astronomy.stackexchange.com/questions/24859/local-sidereal-time
    //      https://observability.date/notes
    //      http://njsas.org/projects/tidal_forces/altaz/pausch/riset.html
    //      http://www.stjarnhimlen.se/comp/tutorial.html
    //      http://www.stargazing.net/kepler/altaz.html
    function object_altaz(date, ra, dec, lat, lng)
    {
        // universal time in decimal hours
        var H = (date % day_ms) / hour_ms;

        // Julian date including fraction - 2451545.0,
        // that is days from J2000
        var D = getJ2000_2(date);

        // calculate local sidereal time in degrees
        var LST = 100.4606184 + 0.9856473662862 * D + H * hoursToDeg + lng;

        // get hours
        LST = LST % 360;

        // calculate local hour angle in degrees
        var LHA = LST - ra;

        // calculate sin(altitude) in radian
        var sin_altitude = sind(lat) * sind(dec) + cosd(lat) * cosd(dec) * cosd(LHA);

        var altitude = Math.asin(sin_altitude) * radToDeg;

        // calculate AZ
        var cos_A = (sind(dec) - sind(altitude)*sind(lat)) / (cosd(altitude)*cosd(lat));

        var A = Math.acos(cos_A) * radToDeg;

        var AZ;
        if (sind(LHA) < 0) {
            AZ = A;
        } else {
            AZ = 360 - A;
        }

        //console.log("object_altaz, last=",LST*degToHours,",lha=",LHA*degToHours,",sinalt=",sin_altitude,",alt=",altitude,",H=",H);

        return {alt:altitude, az:AZ};
    }

    // Do calculations that are not based on RA/DEC
    function object_altitude_init(date, lat, lng)
    {
        // universal time in decimal hours
        var H = (date % day_ms) / hour_ms;

        // Julian date including fraction - 2451545.0,
        // that is days from J2000
        var D = getJ2000_2(date);

        // calculate local sidereal time in degrees
        var LST = 100.4606184 + 0.9856473662862 * D + H * hoursToDeg + lng;

        // get hours
        LST = LST % 360;


        var aa =  {Lst: LST, Sinlat: sind(lat), Coslat: cosd(lat)}

        console.log("object_altitude_init, aa", aa);

        return aa;
    }

    // Calculate altitude on given RA/DEC
    function object_altitude_get(aa, ra, dec)
    {
        // calculate local hour angle in degrees
        var LHA = aa.Lst - ra;

        // calculate sin(altitude) in radian
        var sin_altitude = aa.Sinlat * sind(dec) + aa.Coslat * cosd(dec) * cosd(LHA);

        var altitude = Math.asin(sin_altitude) * radToDeg;

        return altitude;
    }

    // Simplified version of moon position at given time.
    // - there are a lot of variables that affect correct moon position that
    //    are ignored here
    // - we do not correct for altitude
    // Links:
    //      http://www.stjarnhimlen.se/comp/tutorial.html
    function moon_position(date)
    {
        // Days from J2000
        var d = getJD(date);
        var pi = Math.PI;
        var nloop;
        //console.log("moon position d=",d,"JD=",JD1970+d/day_ms);

        var N = scale_to_360(125.1228 - 0.0529538083 * d);
        var i = 5.1454;
        var w = scale_to_360(318.0634 + 0.1643573223 * d);
        var a = 60.2666;
        var e = 0.054900;
        var M = scale_to_360(115.3654 + 13.0649929509 * d);
        //console.log("N",N,"i",i,"w",w,"a",a,"e",e,"M",M);

        var E = M + e*(180/pi) * sind(M) * ( 1.0 + e * cosd(M) );
        for (nloop = 0; nloop < 100; nloop++) {
            var E0 = E;
            E = E0 - (E0 - e * (180/pi) * sind(E0) - M) / (1- e * cosd(E0));
            if (Math.abs(E-E0) <= 0.001) {
                break;
            }
        }
        //console.log("E", E, "nloop", nloop);

        var x = a * ( cosd(E) - e );
        var y = a * Math.sqrt(1.0 - e*e) * sind(E);
        //console.log("x,y",x,y);

        var r = Math.sqrt( x*x + y*y );
        var v = scale_to_360(Math.atan2( y, x ) * radToDeg);
        //console.log("r,v",r,v);

        // moon geocentric position in ecliptic coordinates
        var xeclip = r * ( cosd(N) * cosd(v+w) - sind(N) * sind(v+w) * cosd(i) );
        var yeclip = r * ( sind(N) * cosd(v+w) + cosd(N) * sind(v+w) * cosd(i) );
        var zeclip = r * ( sind(v+w) * sind(i) );
        //console.log("moon xeclip=",xeclip,",yeclip=",yeclip,",zeclip=",zeclip);

        // ecliptic longitude and latitude
        //var lonecl = scale_to_360(Math.atan2( yeclip, xeclip ) * radToDeg);
        //var latecl = Math.atan2( zeclip, Math.sqrt(xeclip*xeclip+yeclip*yeclip) ) * radToDeg;
        //console.log("lonecl,latecl",lonecl,latecl);

        var oblecl = 23.4;

        // rotate ecliptic coordinates to equatorial coordinates
        var xequat = xeclip;
        var yequat = yeclip * cosd(oblecl) - zeclip * sind(oblecl);
        var zequat = yeclip * sind(oblecl) + zeclip * cosd(oblecl);
        //console.log("moon xequat=",xequat,",yequat=",yequat,",zequat=",zequat);

        // calculate RA and Dec
        var RA  = scale_to_360(Math.atan2( yequat, xequat ) * radToDeg);
        var Dec = Math.atan2( zequat, Math.sqrt(xequat*xequat+yequat*yequat) ) * radToDeg;

        //console.log("moon ra",RA,",dec",Dec);

        return {ra:RA, dec:Dec};
    }

    // a simple version for topocentric correction
    function moon_topocentric_correction(alt)
    {
        var r = 60.336;
        return alt - Math.asin(1/r) * cosd(alt);
    }

    // Sun position at given time.
    // Links:
    //      http://www.stjarnhimlen.se/comp/tutorial.html
    function sun_position(date)
    {
        // Days from J2000
        var d = getJD(date);
        var pi = Math.PI;
        //console.log("sun_position d", d);

        var w = scale_to_360(282.9404 + 4.70935E-5 * d);
        var a = 1.0;
        var e = 0.016709 - 1.151E-9 * d;
        var M = scale_to_360(356.0470 + 0.9856002585 * d);

        //console.log(w,a,e,M);

        var oblecl = scale_to_360(23.4393 - 3.563E-7 * d);
        var L = scale_to_360(w + M);
        //console.log("L", L,"oblecl", oblecl);

        var E = scale_to_360((M + (180/pi) * e * sind(M) * (1 + e * cosd(M))));
        //console.log("E", E);

        var x = cosd(E) - e;
        var y = sind(E) * Math.sqrt(1 - e*e);
        //console.log("x,y", x,y);

        var r = Math.sqrt(x*x + y*y);
        var v = Math.atan2( y, x ) * radToDeg;
        //console.log("r,v", r,v);

        var lon = scale_to_360(v + w);
        //console.log("lon", lon);

        x = r * cosd(lon);
        y = r * sind(lon);
        //console.log("x,y", x,y);

        var xequat = x;
        var yequat = y * cosd(oblecl);
        var zequat = y * sind(oblecl);
        //console.log("xequat,yequat", xequat,yequat);

        var RA  = Math.atan2( yequat, xequat ) * radToDeg;
        var Dec = Math.atan2( zequat, Math.sqrt(xequat*xequat+yequat*yequat) ) * radToDeg;

        //console.log("Sun_position", RA, Dec);

        return {ra:RA, dec:Dec};
    }

    // Simplified version of rise and set times.
    // - we do not correct for altitude
    // - we use current day rise time as next day rise time
    // - h is altitude in degrees from horizon
    //   0      center of sun's disk on horizon
    //   -12    nautical twilight
    //   -15    Amateur astronomical twilight
    //   -18    Astronomical twilight
    // Links:
    //      http://www.stjarnhimlen.se/comp/tutorial.html
    function sun_rise_set(midday, lat, lon, h)
    {
        var d = getJD(midday);
        
        var sun_pos = sun_position(midday);
        var LST = sun_pos.ra;

        var w = scale_to_360(282.9404 + 4.70935E-5 * d);
        var M = scale_to_360(356.0470 + 0.9856002585 * d);
        var L = M + w;
        var GMST0 = scale_to_360(L + 180);

        var UT_sun = (LST - GMST0 - lon) * degToHours;
        if (UT_sun < 0) {
            UT_sun = UT_sun + 24;
        }
        //console.log("Sun_rise_set UT_sun", UT_sun);

        // calculate midday at location
        midday = midday - 12 * hour_ms + UT_sun * hour_ms;

        var cos_LHA = (sind(h) - sind(lat)*sind(sun_pos.dec)) / (cosd(lat) * cosd(sun_pos.dec));

        var LHA = (Math.acos(cos_LHA) * radToDeg) * degToHours;
        //console.log("Sun_rise_set LHA", LHA);

        //console.log("Sun_rise_set set rise", 12+LHA, 12-LHA);

        // we use the current day sunrise as the next sunrise which is not exactly correct
        return {sunset: midday + LHA*hour_ms, sunrise: midday - LHA*hour_ms + day_ms};
    }

    // Calculate distance in degrees between two (ra,dec) positions
    function moon_distance(ra1, dec1, ra2, dec2)
    {
        var cos_A = sind(dec1) * sind(dec2) + cosd(dec1) * cosd(dec2) * cosd(ra1 - ra2);
        var A = Math.acos(cos_A) * radToDeg;
        if (A < 0) {
            A = -A;
        }
        if (A > 180) {
            A = 360 - A;
        }
        return A;
    }

    // This method can be found in many places, somehow
    // it gives weird results
    function get_moon_phase2(date)
    {
        var d = getJD(date);

        var v = (d-2451550.1) / 29.530588853;
        v = v - Math.floor(v);
        if (v < 0) {
            v = v + 1;
        }

        var age = v * 29.53;
        return age;
    }

    // My own version, calculate sun-moon angle to get
    // approximate "phase" in percentages
    function get_moon_phase(d)
    {
        var sunpos = sun_position(d);
        var moonpos = moon_position(d);
        var dist = moon_distance(sunpos.ra, sunpos.dec, moonpos.ra, moonpos.dec);
        //console.log("get_moon_phase dist", dist);
        return (scale_to_360(dist) / 180) * 100;
    }

    // Convert to date string to that e.g. 1:0 becomes 01:00
    function toDateString(num)
    {
        if (num < 10) {
            return '0' + num.toString();
        } else {
            return num.toString();
        }
    }

    function setChartOptions(title, hAxisTitle, seriesStyle, hAxisFormat)
    {
        var chartTextStyle = {};
        var gridlinesStyle = {};

        if (engine_params.isCustomMode) {
            console.log("setChartOptions, custom mode");
            chartTextStyle = { color: engine_params.chartTextColor };
            gridlinesStyle = { color: engine_params.gridlinesColor };
        } else {
            console.log("setChartOptions, default mode");
        }

        var options = {
            title: title,
            legendTextStyle: chartTextStyle,
            titleTextStyle: chartTextStyle,
            hAxis: { 
                title: hAxisTitle,
                textStyle: chartTextStyle,
                titleTextStyle: chartTextStyle,
                gridlines: gridlinesStyle,
                format: hAxisFormat
            },
            vAxis: { 
                title: 'Altitude (degrees)',
                textStyle: chartTextStyle,
                titleTextStyle: chartTextStyle,
                gridlines: gridlinesStyle,
            },
            legend:{
                textStyle: chartTextStyle
            },
            // minorGridlines: { units: { hours: {format: ['HH:MM']} } },
            series: seriesStyle
        };
        if (engine_params.isCustomMode) {
            options.backgroundColor = engine_params.backgroundColor;
        }
        return options;
    }

    function dayVisibilityTime(celldate, time_as_string)
    {
        if (time_as_string) {
            return toDateString(celldate.getUTCHours()) + ":" + toDateString(celldate.getUTCMinutes());
        } else {
            return celldate;
        }
    }

    function drawDayVisibilityandGrid() 
    {
        console.log("drawDayVisibilityandGrid, image_target_list.length", image_target_list.length);

        if (engine_view_type == "all"
            || (engine_view_type == "" && engine_panels.aladin_panel != null)) 
        {
            if (image_target_list.length > 1) {
                EngineViewGridFromList(image_target_list);
            } else if (engine_params.hasOwnProperty('offaxis')) {
                EngineViewGridOffaxis(image_target_list);
            } else {
                EngineViewGrid();
            }
        }
        engine_data.daydata = new google.visualization.DataTable();
        // get midday in UTC time in ms
        var midday = engine_params.UTCdate_ms + day_ms/2;

        // For time column string seem to be better than time because
        // Google charts scales the chart with time and does not show
        // the whole night always. We loose vertical grid lines but
        // to me it looks better to see the whole night and not only
        // a part of it.
        var time_as_string = true;
        if (time_as_string) {
            engine_data.daydata.addColumn('string', 'Time');
        } else {
            engine_data.daydata.addColumn('datetime', 'Time');
        }
        engine_data.daydata.addColumn('number', 'Visible');            // object altitude
        if (engine_params.horizonSoft != null) {
            engine_data.daydata.addColumn('number', 'Below soft horizon'); // object altitude if below soft horizon
        }
        engine_data.daydata.addColumn('number', 'Not visible');        // object altitude below hard horizon or meridian transit
        engine_data.daydata.addColumn('number', 'Moon alt');           // moon altitude

        var interval = 5*60*1000; // 5 minutes
        
        var ra = target_ra;
        var dec = target_dec;
        
        var lat = engine_params.location_lat;
        var lng = engine_params.location_lng;

        console.log(ra, dec, lat, lng);

        var rowdata = [];

        var draw_full_day = 0;  // if 0 draw only during astronomical twilight

        // sun rise and set times that closely match dome open times
        var suntimes = sun_rise_set(midday, lat, lng, -12);

        var starttime;
        var endtime;
        if (draw_full_day) {
            starttime = midday;
            endtime = starttime + day_ms;
        } else {
            starttime = suntimes.sunset - suntimes.sunset % interval;
            endtime = suntimes.sunrise + interval - suntimes.sunrise % interval;
        }
        var prevaz = null;
        var meridian_index = null;
        var localdate = new Date();

        for (var d = starttime; d <= endtime; d = d + interval) {
            //console.log("d",d,"sunrise",suntimes.sunrise,"unset",suntimes.sunset);
            var altaz = object_altaz(d, ra, dec, lat, lng);
            //console.log("target az=",altaz.az,",alt=",altaz.alt);
            var objectalt = altaz.alt;

            var moonpos = moon_position(d);
            var moonalt = object_altaz(d, moonpos.ra, moonpos.dec, lat, lng).alt;
            moonalt = moon_topocentric_correction(moonalt);

            var visiblealt = null;     // target visible
            var softalt = null;        // target below soft horizon
            var hardalt = null;        // target below hard horizon or meridian transit

            var horizon_index = Math.round(altaz.az / 5);

            if (prevaz != null) {
                if ((prevaz > 180 && altaz.az < 180) || // from 360 to 0
                    (prevaz < 180 && altaz.az > 180))   // passed 180
                {
                    // save meridian crossing
                    meridian_index = rowdata.length;
                    console.log("meridian_index",meridian_index);
                }
            }
            prevaz = altaz.az;
            if (objectalt > 0) {
                //console.log("objectalt",objectalt,"horizon_index",horizon_index);
                //console.log("soft",horizonSoft[horizon_index],"hard",horizonHard[horizon_index]);
                if (engine_params.horizonSoft != null) {
                    //console.log("drawDayVisibilityandGrid, use both soft and hard horizon");
                    if (objectalt > engine_params.horizonSoft[horizon_index]) {
                        visiblealt = objectalt;
                    } else if (objectalt > engine_params.horizonHard[horizon_index]) {
                        softalt = objectalt;
                    } else {
                        hardalt = objectalt;
                    }
                } else {
                    //console.log("drawDayVisibilityandGrid, only hard horizon");
                    if (objectalt > engine_params.horizonHard[horizon_index]) {
                        visiblealt = objectalt;
                    } else {
                        hardalt = objectalt;
                    }
                }
            }
            if (moonalt < 0) {
                moonalt = null;
            }
            if (engine_params.timezoneOffset == null) {
                if (time_as_string) {
                    var celldate = new Date(d);
                } else {
                    var celldate = new Date(d + localdate.getTimezoneOffset()*60*60*1000);
                }
            } else {
                if (time_as_string) {
                    var celldate = new Date(d + engine_params.timezoneOffset*60*60*1000);
                } else {
                    var celldate = new Date(d + (localdate.getTimezoneOffset() - engine_params.timezoneOffset)*60*60*1000);
                }
            }
            if (engine_params.horizonSoft != null) {
                var row = [
                        dayVisibilityTime(celldate, time_as_string),
                        getAltitudeCellObject(visiblealt),
                        getAltitudeCellObject(softalt),
                        getAltitudeCellObject(hardalt),
                        getAltitudeCellObject(moonalt)];
            } else {
                var row = [
                        dayVisibilityTime(celldate, time_as_string),
                        getAltitudeCellObject(visiblealt),
                        getAltitudeCellObject(hardalt),
                        getAltitudeCellObject(moonalt)];
            }
            //console.log("row", row);
            rowdata[rowdata.length] = row;
        }

        if (meridian_index != null && engine_params.meridian_transit > 0) {
            // Mark Meridian crossing as not visible. We use literal 30 minutes clock time here.
            // Maybe it could be done some other way...
            var timer = Math.round(((engine_params.meridian_transit / 2) * 60 * 1000) / interval);
            var begin = Math.max(meridian_index - timer, 0);
            var end = Math.min(meridian_index + timer, rowdata.length);
            if (engine_params.horizonSoft != null) {
                for (var i = begin; i < end; i++) {
                    if (rowdata[i][1] != null) {        // visiblealt != null
                        rowdata[i][3] = rowdata[i][1];  // hardalt = visiblealt
                        rowdata[i][1] = null;           // visible = null
                    } else if (rowdata[i][2] != null) { // softalt != null
                        rowdata[i][3] = rowdata[i][2];  // hardalt = softalt
                        rowdata[i][2] = null;           // softalt = null
                    }
                }
            } else {
                for (var i = begin; i < end; i++) {
                    if (rowdata[i][1] != null) {        // visiblealt != null
                        rowdata[i][2] = rowdata[i][1];  // hardalt = visiblealt
                        rowdata[i][1] = null;           // visible = null
                    }
                }
            }
        }

        engine_data.daydata.addRows(rowdata);

        if (!time_as_string) {
            /*  The following formatting is needed if showing time as a time. */
            if (engine_params.timezoneOffset == null) {
                var format = new google.visualization.DateFormat({ pattern: 'HH:mm' + " UTC" });
            } else {
                var format = new google.visualization.DateFormat({ pattern: 'HH:mm' });
            }
            format.format(engine_data.daydata, 0);
        }

        if (engine_params.timezoneOffset == null) {
            var hAxisTitle = 'Time (UTC)';
        } else {
            if (engine_params.timezoneOffset >= 0) {
                var hAxisTitle = 'Time (UTC+' + engine_params.timezoneOffset + ')';
            } else {
                var hAxisTitle = 'Time (UTC-' + Math.abs(engine_params.timezoneOffset) + ')';
            }
        }

        if (engine_params.horizonSoft != null) {
            var options = setChartOptions(
                            'Target visibility',
                            hAxisTitle,
                            { 
                                0: { color: 'green' },
                                1: { color: 'orange', lineDashStyle: [4, 2] },
                                2: { color: 'red', lineDashStyle: [2, 2] },
                                3: { color: '#1c91c0', lineDashStyle: [4, 1, 2], lineWidth: 1 }
                            },
                            'HH:mm');
        } else {
            var options = setChartOptions(
                            'Target visibility',
                            hAxisTitle,
                            { 
                                0: { color: 'green' },
                                1: { color: 'red', lineDashStyle: [2, 2] },
                                2: { color: '#1c91c0', lineDashStyle: [4, 1, 2], lineWidth: 1 }
                            },
                            'HH:mm' );
        }

        engine_data.daychart = new google.visualization.LineChart(document.getElementById(engine_panels.dayvisibility_panel));

        engine_data.daychart.draw(engine_data.daydata, options);

        var midnight = suntimes.sunset + (suntimes.sunrise - suntimes.sunset) / 2;

        // We use sun and moon distance in degrees at midnight to approximate 
        // the moon "phase". I guess there is also a correct way...
        var moon_phase = get_moon_phase(midnight);
        // Moon distance from object at midnight. Distance changes during the night
        // but not much so this should be fine.
        var moonpos_midnight = moon_position(midnight);
        var moon_angle = moon_distance(ra, dec, moonpos_midnight.ra, moonpos_midnight.dec);

        if (engine_view_type == "all") {
            document.getElementById(engine_panels.dayvisibility_panel_text).innerHTML = 
                //"Astronomical twilight start : " + UTCsunset.toUTCString() + "<br>" +
                //"Astronomical twilight end : " + UTCsunrise.toUTCString() + "<br>" +
                "Moon phase: " + Math.floor(moon_phase) + "%<br>" +
                "Moon distance from target: " + Math.floor(moon_angle) + " degrees";
        } else if (engine_panels.dayvisibility_panel_text) {
            document.getElementById(engine_panels.dayvisibility_panel_text).style.marginTop = "1px";
            document.getElementById(engine_panels.dayvisibility_panel_text).innerHTML = astro_mosaic_link;
        }
    }

    function getAltitudeCellObject(val)
    {
            if (val == null) {
                return null;
            } else {
                return { v: val, f: val.toFixed(0) + "°" };
            }
    }

    function drawYearVisibility() 
    {
        console.log("drawYearVisibility");

        engine_data.yeardata = new google.visualization.DataTable();
        // get midday in UTC time in ms
        var midday = engine_params.UTCdate_ms + day_ms/2;

        engine_data.yeardata.addColumn('date', 'Date');
        engine_data.yeardata.addColumn('number', 'Visible');            // object altitude
        engine_data.yeardata.addColumn('number', 'Not visible');        // moon altitude
        engine_data.yeardata.addColumn('number', 'Moon alt');           // moon altitude

        var interval = day_ms; // day
        
        var ra = target_ra;
        var dec = target_dec;
        
        var lat = engine_params.location_lat;
        var lng = engine_params.location_lng;

        var rowdata = [];

        var starttime = midday;
        var endtime = starttime + 365 * day_ms;

        for (var d = starttime; d <= endtime; d = d + interval) {
            var suntimes = sun_rise_set(d, lat, lng, 0);

            // get approximate midnight
            var midnight = suntimes.sunset + (suntimes.sunrise - suntimes.sunset) / 2;

            var objectalt = object_altaz(midnight, ra, dec, lat, lng).alt;

            var moonpos = moon_position(midnight);
            var moonalt = object_altaz(midnight, moonpos.ra, moonpos.dec, lat, lng).alt;
            moonalt = moon_topocentric_correction(moonalt);

            var visiblealt = null;     // target visible
            var hardalt = null;        // target below 30 degrees

            if (objectalt >= 30) {
                visiblealt = objectalt;
            } else if (objectalt > 0) {
                hardalt = objectalt;
            }
            if (moonalt < 0) {
                moonalt = null;
            }
            var row = [
                        new Date(d),
                        getAltitudeCellObject(visiblealt),
                        getAltitudeCellObject(hardalt),
                        getAltitudeCellObject(moonalt)
                      ];
            rowdata[rowdata.length] = row;
        }

        engine_data.yeardata.addRows(rowdata);

        var options = setChartOptions(
                        'Target visibility at midnight over next 12 months',
                        'Month',
                        { 
                            0: { color: 'green' },
                            1: { color: 'red', lineDashStyle: [2, 2] },
                            2: { color: '#1c91c0', lineDashStyle: [4, 1, 2], lineWidth: 1 }
                        },
                        "MMM YYYY");

        engine_data.yearchart = new google.visualization.LineChart(document.getElementById(engine_panels.yearvisibility_panel));

        engine_data.yearchart.draw(engine_data.yeardata, options);

        if (engine_view_type != "all" && engine_panels.yearvisibility_panel_text) {
            document.getElementById(engine_panels.yearvisibility_panel_text).style.marginTop = "1px";
            document.getElementById(engine_panels.yearvisibility_panel_text).innerHTML = astro_mosaic_link;
        }
    }

    // update globals when target name is found
    // here we assume target coordinates are in image_target global variable
    function target_name_found()
    {
        resolved_name = image_target;

        // change image_target from name to coordinates
        image_target = trim_spaces(image_target);
        console.log("find_coordinates:image_target=", image_target);
        image_target = reformat_coordinates(image_target);
        //document.getElementById(engine_panels.status_text).innerHTML = "Resolved RA/DEC " + image_target;
        if (engine_view_type == "all") {
            document.getElementById(engine_panels.status_text).innerHTML = "";
        }

        resolved_coordinates = image_target;
    }

    // Find coordinates from Sesame XML output
    // or SIMBAD ascii output
    function find_coordinates(str)
    {
        console.log('find_coordinates');

        var idx = str.indexOf("<jpos>");
        if (idx > 0) {
            console.log('Assume Sesame XML format');
            var coord = str.substr(idx+6, 100);
            console.log("find_coordinates:get coordinates from '", coord, "'");
            var idx2 = coord.indexOf("</jpos>");
            if (idx2 == -1) {
                console.log("find_coordinates:failed to get coordinates from '", coord, "', failed at position ", i.toString());
                return false;
            }
            image_target = coord.substr(0, idx2);
        } else {
            console.log('Simbad ascii output');
            idx = str.indexOf("J2000");
            if (idx == -1) {
                console.log("find_coordinates:could not find 'J2000'");
                return false;
            }
            str = str.substr(idx+4);
            idx = str.indexOf(":");
            if (idx == -1) {
                console.log("find_coordinates:could not find ':'");
                return false;
            }
            var coord = str.substr(idx+1, 100);
            console.log("find_coordinates:get coordinates from '", coord, "'");
            coord = trim_spaces(coord);
            for (var i = 0; i < coord.length; i++) {
                var c = coord.substr(i,1);
                if ((c < '0' || c > '9') && c != '.' && c != '-' && c != '+' && c != ' ') {
                    break;
                }
            }
            if (i < 12) {
                console.log("find_coordinates:failed to get coordinates from '", coord, "', failed at position ", i.toString());
                return false;
            }
            image_target = coord.substr(0, i);
        }

        target_name_found();

        return true;
    }

    // find catalog by name
    function findCatalogName(name)
    {
        var catalog_name = null;
        var target_is_catalog_name = true;
        var is_exact_match = true;
        var retname = name;

        var upname = trim_spaces(name).toUpperCase().replace(/ /g, "");

        if ((upname.substring(0, 1) == 'M' && isNumber(upname.substring(1, 2)))
            || upname.substring(0, 7) == 'MESSIER') 
        {
            catalog_name = 'Messier';
            retname = upname.replace("MESSIER", "M ").replace(/  /g, " ");
            retname = retname.replace("M", "M ").replace(/  /g, " ");
        } else if (upname.substring(0, 3) == 'NGC') {
            retname = upname.replace("NGC", "NGC ").replace(/  /g, " ");
            catalog_name = 'NGC';
        } else if (upname.substring(0, 2) == 'IC') {
            retname = upname.replace("IC", "IC ").replace(/  /g, " ");
            catalog_name = 'IC';
        } else if (upname.substring(0, 3) == 'RCW') {
            retname = upname.replace("RCW", "RCW ").replace(/  /g, " ");
            catalog_name = 'RCW';
        } else if (upname.substring(0, 3) == 'SH2') {
            catalog_name = 'Sharpless';
            retname = upname.replace("SH2", "SH2");
        } else if ((upname.substring(0, 1) == 'G' && isNumber(upname.substring(1, 2))) 
                   || upname.substring(0, 3) == 'GUM') 
        {
            catalog_name = 'RCW';
            retname = upname.replace("GUM", "G ").replace(/ /g, "");
            retname = retname.replace("G", "G ").replace(/ /g, "");
            target_is_catalog_name = false;
            is_exact_match = true;
        } else if ((upname.substring(0, 1) == 'B' && isNumber(upname.substring(1, 2)))
                    || upname.substring(0, 7) == 'Barnard') {
            catalog_name = 'Barnard';
            retname = upname.replace("Barnard", "M ").replace(/  /g, " ");
            retname = retname.replace("B", "B ").replace(/  /g, " ");
        } else {
            target_is_catalog_name = false;
            is_exact_match = false;
        }
        if (catalog_name != null) {
            console.log("findCatalogName " + retname + " from " + catalog_name + ", exact_match " + is_exact_match);
        } else {
            console.log("findCatalogName " + retname + " from all catalogs, exact_match " + is_exact_match);
        }
        return { name: retname, catalog_name: catalog_name, target_is_catalog_name: target_is_catalog_name, is_exact_match: is_exact_match};
    }

    function findTargetFromCatalog(targets, name)
    {
        if (targets == null) {
            console.log("findTargetFromCatalog null catalog");
            return null;
        }
        console.log("findTargetFromCatalog name " + name);
        for (var i = 0; i < targets.length; i++) {
            if (targets[i][0].indexOf(name) != -1) {
                return targets[i];
            }
        }
        return null;
    }

    function isNumber(c)
    {
        if (c == null || c == undefined) {
            return false;
        }
        return c >= '0' && c <= '9';
    } 

    function doExactMatch(s, n)
    {
        var i = s.indexOf(n);
        if (i == -1) {
            return false;
        }
        if (isNumber(s[i + n.length])) {
            // another number follows, so we got G11 instead of G1
            return false;
        }
        console.log("doExactMatch found " + n + " from " + s);
        return true;
    }

    function findExactMatch(targets, name)
    {
        if (targets == null) {
            console.log("findExactMatch null catalog");
            return null;
        }
        console.log("findExactMatch name "+ name);
        for (var i = 0; i < targets.length; i++) {
            if (doExactMatch(targets[i][0], name)       // CAT
               || doExactMatch(targets[i][7], name)     // NAME
               || doExactMatch(targets[i][8], name))    // INFO
            {
                return targets[i];
            }
        }
        return null;
    }

    function findFromCatalog(targets, name)
    {
        if (targets == null) {
            console.log("findFromCatalog null catalog");
            return null;
        }
        console.log("findFromCatalog name " + name);
        var re = new RegExp(name, "i");
        for (var i = 0; i < targets.length; i++) {
            if (targets[i][0].search(re) != -1       // CAT
               || targets[i][7].search(re) != -1     // NAME
               || targets[i][8].search(re) != -1)    // INFO
            {
                return targets[i];
            }
        }
        return null;
    }

    // if name resolver fails try to resolve name from loaded catalogs
    function resolveNameFromCatalogs(name)
    {
        console.log("resolveNameFromCatalogs " + name);

        var catinfo = findCatalogName(name);
        var target_info = null;

        for (var i = 0; i < engine_catalogs.length; i++) {
            if (catinfo.catalog_name != null) {
                // we check specific catalog
                if (catinfo.catalog_name != engine_catalogs[i].name) {
                    // not the catalog we want to check
                    console.log("resolveNameFromCatalogs skip catalog " + engine_catalogs[i].name);
                    continue;
                }
            }
            console.log("resolveNameFromCatalogs check catalog " + engine_catalogs[i].name + " for name " + catinfo.name);
            if (catinfo.target_is_catalog_name) {
                target_info = findTargetFromCatalog(engine_catalogs[i].targets, catinfo.name);
            } else if (catinfo.is_exact_match) {
                target_info = findExactMatch(engine_catalogs[i].targets, catinfo.name);
            } else {
                target_info = findFromCatalog(engine_catalogs[i].targets, catinfo.name);
            }
            if (target_info != null) {
                // found
                break;
            }
        }
        if (target_info != null) {
            // found the target
            image_target = target_info[1] + " " + target_info[2];
            console.log("resolveNameFromCatalogs found '" + target_info + "', image_target " + image_target);
            target_name_found();
            return true;
        } else {
            console.log("resolveNameFromCatalogs not found");
            return false;
        }
    }

    // Resolve image coordinates from Sesame database using name
    function EngineViewImageByName()
    {
        console.log('EngineViewImageByName');

        if (resolved_name == image_target && resolved_coordinates != null) {
            // same name already resolved, do not resolve again
            if (engine_panels.status_text) {
                document.getElementById(engine_panels.status_text).innerHTML = "RA/DEC " + resolved_coordinates;
            }
            image_target = resolved_coordinates;
            EngineViewImageByType();
            return;
        }

        // Simbad ascii, some problems when accessing the site
        // var resolver_url = "https://simbad.u-strasbg.fr/simbad/sim-id?output.format=ASCII&Ident=";
        
        // Mirror of Simbad u-strasbg? Worked when u-strasbg failed.
        // var resolver_url = "http://simbad.cfa.harvard.edu/simbad/sim-id?output.format=ASCII&Ident=";

        // Sesame uses Simbad, NED and Vizier for resolving. Best documented interface.
        var resolver_url = "https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oxp/SNV?";

        resolver_url = resolver_url + image_target.replace(/ /g, "+");

        if (engine_panels.error_text) {
            var waitingTimeout = setTimeout(function() {
                                    document.getElementById(engine_panels.error_text).innerHTML = "Resolving name..."; 
                                }, 1000);
        }

        fetch(resolver_url)
            .then(
                function(response) {
                    if (response.status !== 200) {
                        clearTimeout(waitingTimeout);
                        console.log('Problem accessing Sesame name resolver. Status Code: ' + response.status);
                        if (resolveNameFromCatalogs(image_target)) {
                            EngineViewImageByType();
                        } else {
                            engine_error_text = 'Sesame and local name resolve failed';
                            if (engine_panels.error_text) {
                                document.getElementById(engine_panels.error_text).innerHTML = engine_error_text;
                            }
                            return;
                        }
                    }
                    response.text().then(function(text) {
                        clearTimeout(waitingTimeout);
                        if (find_coordinates(text)) {
                            EngineViewImageByType();
                        } else if (resolveNameFromCatalogs(image_target)) {
                            EngineViewImageByType();
                        } else {
                            engine_error_text = "Failed to resolve name " + image_target;
                            console.log(engine_error_text);
                            if (engine_panels.error_text) {
                                document.getElementById(engine_panels.error_text).innerHTML = engine_error_text;
                            }
                        }
                    })
                }
            )
            .catch(function(err) {
                console.log('Problem accessing Sesame name resolver. Fetch Error :' + err);
                clearTimeout(waitingTimeout);
                if (resolveNameFromCatalogs(image_target)) {
                    EngineViewImageByType();
                } else {
                    engine_error_text = 'Sesame and local name resolve failed';
                    if (engine_panels.error_text) {
                        document.getElementById(engine_panels.error_text).innerHTML = engine_error_text;
                    }
                }
            }
        );
    }

    // Remove leading, trailing and duplicate spaces
    function trim_spaces(str)
    {
        // replace all whitespace to space
        str = str.replace(/\s/g, " ");
        // remove leading and trailing spaces
        str = str.trim();
        for (var i = 0; i < str.length && str.indexOf('  ') != -1; i++) {
            // remove all duplicate spaces
            str = str.replace(/  /g, " ");
        }
        return str;
    }

    function decimal_to_mmss(v)
    {
        var sign = '';
        v = v.trim();
        //console.log("decimal_to_mmss, v", v);
        var index = v.indexOf('.');
        if (index == -1) {
            //console.log("decimal_to_mmss, no dot found", v);
            return v;
        }
        var vd = v.substring(index+1);
        //console.log("decimal_to_mmss, vd", vd);
        var d = parseFloat("0."+vd);
        //console.log("decimal_to_mmss, d", d);
        var secs = d * 3600;
        var mins = Math.floor(secs / 60);
        //console.log("decimal_to_mmss, mins", mins);
        secs = secs - mins*60;
        //console.log("decimal_to_mmss, secs", secs);

        var x = v.substring(0, index);
        //console.log("decimal_to_mmss, x", x);
        if (x.charAt(0) == '-') {
            sign = '-';
            x = x.substring(1);
            //console.log("decimal_to_mmss, after sign, x", x);
        }

        var ret = sign + ("0" + x).slice(-2) + ':' + ("0" + mins).slice(-2) + ':' + secs.toFixed(2);
        //console.log("decimal_to_mmss, ret", ret);

        return ret;
    }

    // split [-]XXYYZZ to [-]XX:YY:ZZ
    function split_coord(coord)
    {
            if (coord.length == 7) {
                return coord.substring(0, 1) + split_coord(coord.substring(1));
            } else {
                return coord.substring(0, 2) + ':' +
                    coord.substring(2, 4) + ':' +
                    coord.substring(4); 
            }
    }

    function fix_field_lenght(fld)
    {
        var sign;

        //console.log("fix_field_lenght:in", fld)

        if (fld.charAt(0) == '-') {
            sign = '-';
            fld = fld.substring(1);
        } else {
            sign = '';
        }
        var s = fld.split('.');
        if (s.length > 1) {
            // We have decimals
            fld = sign + ("0" + s[0]).slice(-2) + '.' + (s[1] + "0").slice(0, 2);
        } else {
            fld = sign + ("0" + fld).slice(-2);
        }
        //console.log("fix_field_lenght:out", fld)
        return fld;
    }

    // Ensure that format is HH:MM:SS DD:MM:SS, that is,
    // two numbers on each field.
    function reformat_coordinates_field_lenghts(coord)
    {
        var radec = coord.split(" ");
        for (var i = 0; i < radec.length; i++) {
            var fields = radec[i].split(":");
            for (var j = 0; j < fields.length; j++) {
                fields[j] = fix_field_lenght(fields[j]);
            }
            if (fields.length == 3) {
                radec[i] = fields[0] + ':' + fields[1] + ':' + fields[2];
            } else if (fields.length == 2) {
                var mmsplit = fields[1].split('.');
                if (mmsplit.length == 2) {
                    // we have decimals in minutes
                    radec[i] = fields[0] + ':' + mmsplit[0] + ':' + mmsplit[1];
                } else {
                    radec[i] = fields[0] + ':' + fields[1] + ':00';
                }
                
            }
        }
        return radec[0] + ' ' + radec[1];
    }

    // Reformat coordinates to a format HH:MM:SS DD:MM:SS
    // Input can be: 
    // HH:MM:SS DD:MM:SS, HH MM SS DD MM SS, 
    // HH:MM:SS/DD:MM:SS, HH MM SS/DD MM SS,
    // HHMMSS DDMMSS
    // HH.dec DD.dec
    function reformat_coordinates(coord)
    {
        // number, assume coordinates
        coord = trim_spaces(coord);
        //console.log('reformat_coordinates=', coord);
        var numbers = coord.split('/');
        if (numbers.length == 2) {
            coord = trim_spaces(numbers[0] + ' ' + numbers[1]);
            console.log('reformat_coordinates, split by /', coord);
        }
        numbers = coord.split(' ');
        //console.log('reformat_coordinates, numbers.length=', numbers.length);
        if (numbers.length == 2) {
            var ra = numbers[0];
            var dec = numbers[1];
            if (ra.split(':').length == 1) {
                if (ra.indexOf('.') == -1 && dec.indexOf('.') == -1) {
                    //console.log('no dots, assume HHMMSS DDMMSS');
                    coord = split_coord(ra) + ' ' + split_coord(dec);
                    //console.log('reformat_coordinates, length 2, assume HHMMSS DDMMSS', coord);
                } else {
                    //console.log('assume HH.dec DD.dec, convert to HH:MM:SS DD:MM:SS');
                    coord = decimal_to_mmss(ra) + ' ' + decimal_to_mmss(dec);
                    //console.log('reformat_coordinates, length 2, assume correct HH.dec DD.dec', coord);
                }
            } else {
                //console.log('reformat_coordinates, length 2 and we have :, assume correct format HH:MM:SS DD:MM:SS', coord);
            }
        } else if (numbers.length == 6) {
            //console.log('separated by space, add colons');
            coord = numbers[0] + ':' + numbers[1] + ':' + numbers[2] + ' ' +
                    numbers[3] + ':' + numbers[4] + ':' + numbers[5];
            //console.log('reformat_coordinates, length "+numbers.length+", use as-is', coord);
        } else if (numbers.length == 5) {
            //console.log('badly formatted SIMBAD case, assume zero last number, separated by space, add colons');
            coord = numbers[0] + ':' + numbers[1] + ':' + numbers[2] + ' ' +
                    numbers[3] + ':' + numbers[4] + ':' + 0;
            //console.log('reformat_coordinates, length "+numbers.length+", use as-is', coord);
        } else {
            //console.log('use as-is');
            //console.log('reformat_coordinates, length 6, reformat', coord);
        }
        coord = reformat_coordinates_field_lenghts(coord);
        //console.log('reformat_coordinates, field lengths fixed', coord);
        return coord;
    }

    function EngineViewImageByType()
    {
        console.log('EngineViewImageByType');
        if (!get_image_target_ra_dec()) {
            engine_error_text = "Failed to parse target RA/DEC";
            console.log(engine_error_text);
            if (engine_panels.error_text) {
                document.getElementById(engine_panels.error_text).innerHTML = engine_error_text;
            }
            return;
        }
        if (engine_view_type == "all" && grid_type == 'panels') {
            EngineViewPanels();
        } else {
            if (engine_view_type == "target") {
                EngineViewGrid();
            } else {
                google.charts.load('current', {'packages':['corechart']});
                if (engine_view_type == "all" 
                    || engine_view_type == "day"
                    || (engine_view_type == "" && engine_panels.dayvisibility_panel != null)) 
                {
                    google.charts.setOnLoadCallback(drawDayVisibilityandGrid);
                }
                if (engine_view_type == "all" 
                    || engine_view_type == "year"
                    || (engine_view_type == "" && engine_panels.yearvisibility_panel != null)) 
                {
                    google.charts.setOnLoadCallback(drawYearVisibility);
                }
            }
        }
    }

    function EngineInitAladin(aladin_fov, aladin_target)
    {
        console.log('EngineInitAladin', aladin_target, engine_panels.aladin_panel, engine_view_type);
        var aladin = null;
        var layers;
        var fullscreen;
        if (engine_view_type == "all") {
            layers = true;
            fullscreen = true;
        } else {
            layers = false;
            fullscreen = false;
        }
        if (A) {
            document.getElementById(engine_panels.aladin_panel).innerHTML = "";
            aladin = A.aladin('#'+engine_panels.aladin_panel, {survey: "P/DSS2/color", fov:aladin_fov, target:aladin_target,
                            showReticle:false, showZoomControl:false, showFullscreenControl:fullscreen, 
                            showLayersControl:layers, showGotoControl:false, 
                            showControl: false, cooFrame: "J2000", showFrame: false});
        } else {
            document.getElementById(engine_panels.aladin_panel).innerHTML = "<p>Could not access Aladin Sky Atlas</p>";
        }
        if (aladin && engine_catalogs) {
            for (var i = 0; i < engine_catalogs.length; i++) {
                if (engine_catalogs[i].AladinCatalog != null) {
                    if (!skip_slooh_catalog(current_telescope_service, engine_catalogs[i])) {
                        aladin.addCatalog(engine_catalogs[i].AladinCatalog);
                    }
                }
            }
        }

        // define function triggered when an object is clicked
        if (aladin && engine_view_type == "all") {
            console.log('EngineInitAladin, set objectClicked');
            aladin.on('objectClicked', function(object) {
                if (object) {
                    console.log('aladin objectClicked, show object');
                    object.select();
                    engine_native_resources.aladin_object_clicked(object.data);
                } else {
                    console.log('aladin objectClicked, no object');
                }
            });
        }
        return aladin;
    }

    function EngineViewGrid()
    {
        var grid_size_x;
        var grid_size_y;

        console.log('EngineViewGrid');

        grid_size_x = engine_params.grid_size_x;
        grid_size_y = engine_params.grid_size_y;

        if (grid_size_x == 1 && grid_size_y == 1) {
            grid_type = "fov";
        }
        if (grid_type == "mosaic") {
            var size_x = grid_size_x / 2 - 0.5;
            var size_y = grid_size_y / 2 - 0.5;
        } else {
            var size_x = 1;
            var size_y = 1;
            grid_size_x = 3;
            grid_size_y = 3;
        }

        // Show image and get coordinates from there to
        // calculate grid boxes.
        var aladin_fov;
        if (grid_type == "mosaic") {
            if (grid_size_x > grid_size_y) {
                aladin_fov = (grid_size_x+0.2)*Math.max(engine_params.fov_x, engine_params.fov_y)*aladin_fov_extra;
            } else {
                aladin_fov = (grid_size_y+0.2)*Math.max(engine_params.fov_x, engine_params.fov_y)*aladin_fov_extra;
            }
        } else {
            aladin_fov = 1.2*Math.max(engine_params.fov_x, engine_params.fov_y)*aladin_fov_extra;
        }

        engine_data.aladin = EngineInitAladin(aladin_fov, image_target);

        var radec = null;
        if (engine_data.aladin) {
            radec = engine_data.aladin.getRaDec();
        }

        console.log("center RaDec = ", radec);

        var ra = radec[0];
        var dec = radec[1];

        var x;
        var y;
        var row = size_y;
        var col;
        var panel_radec = [];
        for (x = 0; x < grid_size_x; x++) {
            panel_radec[x] = [];
        }
        y = 0;
        while (row >= -size_y) {
            var row_dec = dec + row * img_fov * engine_params.fov_y;
            col = size_x;
            x = 0;
            while (col >= -size_x) {
                var col_ra = ra + col * (img_fov * engine_params.fov_x * (1/Math.cos(degrees_to_radians(Math.abs(row_dec)))));

                // now center ra/dec is col_ra/row_dec
                // calculate corners
                var row_dec1 = row_dec + engine_params.fov_y/2;
                var row_dec2 = row_dec - engine_params.fov_y/2;
                var col_ra1 = ra + col * (img_fov * engine_params.fov_x * (1/Math.cos(degrees_to_radians(Math.abs(row_dec1)))));
                var col_ra2 = ra + col * (img_fov * engine_params.fov_x * (1/Math.cos(degrees_to_radians(Math.abs(row_dec2)))));
                var col_ra1_delta = ((engine_params.fov_x/2) * (1/Math.cos(degrees_to_radians(Math.abs(row_dec1)))));
                var col_ra2_delta = ((engine_params.fov_x/2) * (1/Math.cos(degrees_to_radians(Math.abs(row_dec2)))));

                var panel = [
                    [col_ra1-col_ra1_delta, row_dec1], 
                    [col_ra1+col_ra1_delta, row_dec1], 
                    [col_ra2+col_ra2_delta, row_dec2], 
                    [col_ra2-col_ra2_delta, row_dec2], 
                    [col_ra1-col_ra1_delta, row_dec1]
                ];

                var line_color = '#ee2345';

                if ((grid_type == "mosaic" || (x == 1 && y == 1)) && engine_data.aladin) {
                    var overlay = A.graphicOverlay({color: line_color, lineWidth: 2});
                    engine_data.aladin.addOverlay(overlay);
                    overlay.add(A.polyline(panel));
                }
                col = col - 1;

                var col_ra_hours = col_ra * degToHours;

                if (grid_type == "mosaic") {
                    if (current_telescope_service.radec_format == 0) {
                        panel_radec[x][y] = col_ra_hours.toFixed(5) + 
                                            " " + row_dec.toFixed(5);
                    } else {
                        panel_radec[x][y] = reformat_coordinates(
                                                col_ra_hours.toFixed(5) + " " + row_dec.toFixed(5));
                    }
                } else {
                    /* We show only one scope FoV (default) so show
                    * coordinates in different formats.
                    */
                    panel_radec[x][y] = "RA/DEC " + 
                                        col_ra_hours.toFixed(5) + " " + row_dec.toFixed(5) + ", " + 
                                        ra.toFixed(5) + " " + dec.toFixed(5) + ", " +
                                        image_target;
                }
                x = x + 1;
            }
            row = row - 1;
            y = y + 1;
        }
        if (grid_type == "mosaic") {
            if (engine_panels.aladin_panel_text) {
                document.getElementById(engine_panels.aladin_panel_text).innerHTML = panel_radec[1][1];
                var tab = document.createElement("TABLE");
                tab.style.width = "100%";
                tab.style.borderCollapse="collapse";
                for (y = 0; y < grid_size_y; y++) {
                    var tabrow = document.createElement("TR");
                    tab.appendChild(tabrow);
                    for (x = 0; x < grid_size_x; x++) {
                        var tabdata = document.createElement("TD");
                        var celltext = document.createTextNode(panel_radec[x][y]);
                        tabdata.style.border = "1px solid #dddddd";
                        tabdata.style.padding = "4px";
                        tabdata.appendChild(celltext);
                        tabrow.appendChild(tabdata);
                    }
                }
                document.getElementById(engine_panels.aladin_panel_text).innerHTML = "";
                document.getElementById(engine_panels.aladin_panel_text).appendChild(tab);
            }
        } else {
            if (engine_view_type == "all") {
                document.getElementById(engine_panels.aladin_panel_text).innerHTML = panel_radec[1][1];
            } else if (engine_panels.aladin_panel_text) {
                document.getElementById(engine_panels.aladin_panel_text).style.marginTop = "1px";
                document.getElementById(engine_panels.aladin_panel_text).innerHTML = astro_mosaic_link;
            }
        }
    }

    function EngineViewGridFromList(coordinates)
    {
        console.log('EngineViewGridFromList');

        var grid_size = coordinates.length;

        // Show image and get coordinates from there to
        // calculate grid boxes.
        var aladin_fov;
        if (engine_params.fov_x > engine_params.fov_y) {
            aladin_fov = (grid_size+0.2)*engine_params.fov_x;
        } else {
            aladin_fov = (grid_size+0.2)*engine_params.fov_y;
        }

        engine_data.aladin = EngineInitAladin(aladin_fov, coordinates[0]);
        var radec = null;

        console.log("center RaDec = ", coordinates[0]);

        for (var i = 0; i < coordinates.length; i++) {
            radec = get_ra_dec(coordinates[i]);
            var col_ra = radec[0];
            var row_dec = radec[1];

            console.log("panel "+i+" ra/dec=", col_ra, "/", row_dec);

            // calculate corners
            drawBox(col_ra, row_dec, engine_params.fov_x, engine_params.fov_y);
        }
    }

    function drawBox(col_ra, row_dec, fov_x, fov_y)
    {
        console.log('drawBox', col_ra, row_dec, fov_x, fov_y);

        // calculate image corners
        var row_dec1 = row_dec + fov_y/2;
        var row_dec2 = row_dec - fov_y/2;
        var col_ra1 = col_ra;
        var col_ra2 = col_ra;
        var col_ra1_delta = ((fov_x/2) * (1/Math.cos(degrees_to_radians(Math.abs(row_dec1)))));
        var col_ra2_delta = ((fov_x/2) * (1/Math.cos(degrees_to_radians(Math.abs(row_dec2)))));

        var panel = [
            [col_ra1-col_ra1_delta, row_dec1], 
            [col_ra1+col_ra1_delta, row_dec1], 
            [col_ra2+col_ra2_delta, row_dec2], 
            [col_ra2-col_ra2_delta, row_dec2], 
            [col_ra1-col_ra1_delta, row_dec1]
        ];

        var line_color = '#ee2345';
        if (engine_data.aladin) {
            var overlay = A.graphicOverlay({color: line_color, lineWidth: 2});
            engine_data.aladin.addOverlay(overlay);
            overlay.add(A.polyline(panel));
        }
    }

    // Show telescope Fov and offaxis guiding FoV
    // https://ruuth.xyz/AstroMosaic.html?set_service=Fuji%20X-T3,400mm,206,137,60.04298,24.24452,tz:2,weather:detect_location&add_offaxis=Fuji%20X-T3,400mm,2,2,1,T
    function EngineViewGridOffaxis()
    {
        console.log('EngineViewGridOffaxis');

        var total_fov_x = engine_params.fov_x + engine_params.offaxis.fov_x;
        var total_fov_y = engine_params.fov_y;

        // Show image and get coordinates from there to
        // calculate grid boxes.
        var aladin_fov = 1.2*Math.max(total_fov_x, total_fov_y)*aladin_fov_extra;

        engine_data.aladin = EngineInitAladin(aladin_fov, image_target);
        var radec = null;

        console.log("center RaDec = ", image_target);

        radec = get_ra_dec(image_target);
        var col_ra = radec[0];
        var row_dec = radec[1];

        console.log("ra/dec=", col_ra, "/", row_dec);

        // telescope FoV
        drawBox(col_ra, row_dec, engine_params.fov_x, engine_params.fov_y);

        // offaxis guiding FoV
        switch (engine_params.offaxis.position) {
            case 'T':
                drawBox(
                    col_ra, 
                    row_dec + engine_params.fov_y/2 + engine_params.offaxis.offset + engine_params.offaxis.fov_y/2,
                    engine_params.offaxis.fov_x, 
                    engine_params.offaxis.fov_y);
                break;
            case 'B':
                drawBox(
                    col_ra, 
                    row_dec - engine_params.fov_y/2 - engine_params.offaxis.offset - engine_params.offaxis.fov_y/2,
                    engine_params.offaxis.fov_x, 
                    engine_params.offaxis.fov_y);
                break;
            case 'L':
                drawBox(
                    col_ra + 
                        (engine_params.fov_x/2 + engine_params.offaxis.offset + engine_params.offaxis.fov_x/2) *
                        (1/Math.cos(degrees_to_radians(Math.abs(row_dec)))), 
                    row_dec,
                    engine_params.offaxis.fov_x, 
                    engine_params.offaxis.fov_y);
                break;
            case 'R':
                drawBox(
                    col_ra - 
                        (engine_params.fov_x/2 + engine_params.offaxis.offset + engine_params.offaxis.fov_x/2) *
                        (1/Math.cos(degrees_to_radians(Math.abs(row_dec)))),
                    row_dec,
                    engine_params.offaxis.fov_x, 
                    engine_params.offaxis.fov_y);
                break;
        }

        var col_ra_hours = col_ra * degToHours;
        panel_radec = "RA/DEC " + 
            col_ra_hours.toFixed(5) + " " + row_dec.toFixed(5) + ", " + 
            col_ra.toFixed(5) + " " + row_dec.toFixed(5) + ", " +
            image_target;

        document.getElementById(engine_panels.aladin_panel_text).innerHTML = panel_radec;
    }

    function EngineViewPanels()
    {
        console.log('EngineViewPanels');

        var grid_size_x = engine_params.grid_size_x;
        var grid_size_y = engine_params.grid_size_y;
        if (grid_size_x == 1 && grid_size_y == 1) {
            EngineViewGrid();
            return;
        }
        if (grid_size_x > 5) {
            document.getElementById(engine_panels.error_text).innerHTML = "Max size in panels view is 5x5";
            grid_size_x = 5;
        }
        if (grid_size_y > 5) {
            document.getElementById(engine_panels.error_text).innerHTML = "Max size in panels view is 5x5";
            grid_size_y = 5;
        }

        engine_native_resources.reset_view();

        var size_x = grid_size_x / 2 - 0.5;
        var size_y = grid_size_y / 2 - 0.5;

        console.log("image_target=" + image_target);
        var ra = target_ra;
        var dec = target_dec;

        var i = 0;
        var row = size_y;
        var col;
        var row_number = 0;
        var y = 0;
        while (row >= -size_y) {
            var row_dec = dec + row * img_fov * engine_params.fov_y;
            col = size_x;
            var panel_number = 5 * row_number;
            var x = 0;
            while (col >= -size_x) {
                var col_ra = ra + col * (img_fov * engine_params.fov_x * (1/Math.cos(degrees_to_radians(Math.abs(row_dec)))));
                // convert from degrees to hours
                col_ra = col_ra * degToHours;

                var point_ra_hour = Math.floor(col_ra);
                var point_ra_sec = (Math.abs(col_ra) - Math.abs(point_ra_hour)) * 3600;
                var point_ra_min = Math.floor(point_ra_sec / 60);
                point_ra_sec = point_ra_sec - point_ra_min * 60;
        
                var point_dec_hour = Math.floor(row_dec);
                var point_dec_sec = (Math.abs(row_dec) - Math.abs(point_dec_hour)) * 3600;
                var point_dec_min = Math.floor(point_dec_sec / 60);
                point_dec_sec = point_dec_sec - point_dec_min * 60;
        
                aladin_target_str = point_ra_hour.toString() + ":" + point_ra_min.toString() + ":" + point_ra_sec.toFixed(2) + " ";
                aladin_target_str = aladin_target_str + point_dec_hour.toString() + ":" + point_dec_min.toString() + ":" + point_dec_sec.toFixed(2);

                var panel_id = engine_panels.panel_view_div + y.toString() + x.toString();
                console.log('EngineViewPanels, panel_id='+panel_id);
                if (engine_params.fov_x != engine_params.fov_y) {
                    var height = 300 * engine_params.fov_y / engine_params.fov_x;
                    document.getElementById(panel_id).style.height = Math.floor(height).toString() + "px";
                } else {
                    document.getElementById(panel_id).style.height = "300px";
                }
                if (A) {
                    engine_data.aladinarr[i] = A.aladin('#'+panel_id, {survey: "P/DSS2/color", fov:engine_params.fov_x, target: aladin_target_str,
                                                showReticle:false, showZoomControl:false, showFullscreenControl:false, 
                                                showLayersControl:false, showGotoControl:false,
                                                showControl: false, cooFrame: "J2000", showFrame: false});
                }
                document.getElementById(engine_panels.panel_view_text+y.toString()+x.toString()).innerHTML = (i+1).toString() + " RA/DEC " + col_ra.toFixed(5) + " " + row_dec.toFixed(5);
                col = col - 1;
                i = i + 1;
                panel_number = panel_number + 1;
                x = x + 1;
            }
            row = row - 1;
            row_number = row_number + 1;
            y = y + 1;
        }
    }
}
