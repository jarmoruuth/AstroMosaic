import datetime
import math
import requests
import ephem

class AstroMosaicEngine:
    """
    A Python conversion of the AstroMosaic telescope planner engine.

    This class provides methods to calculate visibility for celestial targets
    and generate mosaic coordinates, returning data in tabular format (lists of dictionaries).

    Attributes:
        target (str): The coordinates of the target.
        lat (str): Latitude of the observer's location.
        lon (str): Longitude of the observer's location.
        fov_x_deg (float): Field of view in degrees along the X-axis.
        fov_y_deg (float): Field of view in degrees along the Y-axis.
        observation_date (datetime.datetime or str): The date for which to calculate visibility.
        timezone_offset (int): Timezone offset in hours from UTC.

    Requirements:
        - ephem: For astronomical calculations.
        - requests: For resolving target names using CDS Sesame service.
    """

    def __init__(self, target, lat, lon, fov_x_deg, fov_y_deg, observation_date=None, timezone_offset=0):
        self.target_name_or_coords = target
        self.lat = str(lat)
        self.lon = str(lon)
        self.fov_x_deg = fov_x_deg
        self.fov_y_deg = fov_y_deg
        self.timezone_offset = timezone_offset

        self.observer = ephem.Observer()
        self.observer.lat = self.lat
        self.observer.lon = self.lon
        self.observer.elevation = 0  # Assuming sea level

        # --- MODIFICATION START ---
        # Handle different types for observation_date for user convenience.
        if observation_date is None:
            # Default to the current time if no date is provided.
            self.start_date = datetime.datetime.now(datetime.timezone.utc)
        elif isinstance(observation_date, str):
            # Handle date string in 'YYYY-MM-DD' format.
            try:
                # Interpret the date as the start of the day in UTC.
                self.start_date = datetime.datetime.strptime(observation_date, '%Y-%m-%d').replace(tzinfo=datetime.timezone.utc)
            except ValueError:
                raise ValueError("Date string must be in 'YYYY-MM-DD' format.")
        elif isinstance(observation_date, datetime.datetime):
            # If a datetime object is passed, ensure it's timezone-aware (in UTC).
            if observation_date.tzinfo is None:
                self.start_date = observation_date.replace(tzinfo=datetime.timezone.utc)
            else:
                self.start_date = observation_date.astimezone(datetime.timezone.utc)
        elif isinstance(observation_date, datetime.date):
            # If a date object is passed, convert it to datetime at the start of the day.
            self.start_date = datetime.datetime.combine(observation_date, datetime.time.min).replace(tzinfo=datetime.timezone.utc)
        else:
            raise TypeError("observation_date must be a 'YYYY-MM-DD' string, datetime.date, or datetime.datetime object.")
        # --- MODIFICATION END ---
        
        self.observer.date = self.start_date.strftime('%Y/%m/%d %H:%M:%S')

        self.ra_deg, self.dec_deg = self._resolve_target(self.target_name_or_coords)
        if self.ra_deg is None:
            raise ValueError(f"Could not resolve target: {self.target_name_or_coords}")
        # print(f"Resolved target '{self.target_name_or_coords}' to RA: {self.ra_deg}, Dec: {self.dec_deg}")

        self.target_body = self._create_fixed_body(self.ra_deg, self.dec_deg)
        
    def _create_fixed_body(self, ra_deg, dec_deg):
        """Creates a PyEphem Body object for a fixed RA/Dec coordinate."""
        body = ephem.FixedBody()
        body._ra = ephem.degrees(str(ra_deg))
        body._dec = ephem.degrees(str(dec_deg))
        body._epoch = ephem.J2000
        body.compute(self.observer)
        return body

    # function to convert ra dec in hours and degrees to degrees
    def _convert_ra_dec_to_deg(self, ra_hours, dec_degrees):
        """Converts RA in hours and Dec in degrees to decimal degrees."""
        ra_deg = ra_hours * 15.0  # 1 hour = 15 degrees
        if dec_degrees < -90 or dec_degrees > 90:
            raise ValueError("Declination must be between -90 and 90 degrees.")
        return ra_deg, dec_degrees
    
    # function to convert string format 09:55:33.17 69:03:55.00 to degrees
    def _convert_str_to_deg(self, ra_str, dec_str):
        """Converts RA/Dec in string format to decimal degrees."""
        try:
            ra_parts = [float(part) for part in ra_str.split(':')]
            dec_parts = [float(part) for part in dec_str.split(':')]
            if len(ra_parts) != 3 or len(dec_parts) != 3:
                raise ValueError("RA and Dec must be in 'HH:MM:SS.ss' format.")
            ra_deg = (ra_parts[0] + ra_parts[1]/60 + ra_parts[2]/3600) * 15.0  # Convert to degrees
            dec_deg = dec_parts[0] + dec_parts[1]/60 + dec_parts[2]/3600
            if dec_deg < -90 or dec_deg > 90:
                raise ValueError("Declination must be between -90 and 90 degrees.")
            return ra_deg, dec_deg
        except ValueError as e:
            raise ValueError(f"Invalid RA/Dec format: {e}")
    
    def _resolve_target(self, target_str):
        """Resolves a target name to RA/Dec coordinates using the CDS Sesame service."""
        target_str = target_str.strip()
        # Check if target is already in a parsable coordinate format
        try:
            # If target_str starts with d then it is followed by decimal ra dec
            if target_str.startswith('d'):
                ra_str, dec_str = target_str.split()
                return float(ra_str), float(dec_str)
            # If target_str is in HH:MM:SS.ss format
            if ':' in target_str:
                ra_str, dec_str = target_str.replace(',', ' ').split()
                return self._convert_str_to_deg(ra_str, dec_str)
            # If target_str is in decimal degrees format
            if ' ' in target_str:
                ra_str, dec_str = target_str.split()
                return self._convert_ra_dec_to_deg(float(ra_str), float(dec_str))
            # Error, not a know format
            raise ValueError("Target must be in 'HH:MM:SS.ss DD:MM:SS.ss' or 'RA Dec' format, or a name resolvable by CDS Sesame.")
        except (ValueError, AttributeError):
            # Not simple float coordinates, try to resolve the name
            # Does not seem to work correctly
            resolver_url = f"https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oI/A?{target_str}"
            try:
                response = requests.get(resolver_url)
                response.raise_for_status()
                # The -oI/A output is a simple line with J2000 coordinates
                # Example: #J2000 299.8681521 +40.7344421 = 19:59:28.356 +40:44:03.99 M39
                result_line = response.text.splitlines()[0]
                if result_line.startswith("#J2000"):
                    parts = result_line.split()
                    ra_deg = float(parts[1])
                    dec_deg = float(parts[2])
                    # print(f"Resolved '{target_str}' to RA: {ra_deg}, Dec: {dec_deg}")
                    return ra_deg, dec_deg
            except requests.RequestException as e:
                print(f"Error resolving name with Sesame: {e}")
                return None, None
        return None, None

    def get_day_visibility(self, interval_minutes=5, twilight_angle=-12):
        """
        Calculates the visibility of the target for a single night.
        Returns data as a list of dictionaries.
        """
        self.observer.horizon = str(twilight_angle)
        
        # Set the observer to the start date for calculation
        self.observer.date = self.start_date

        # Start of the night is previous setting of the sun
        try:
            sunset_time = self.observer.previous_setting(ephem.Sun(), use_center=True).datetime()
        except ephem.AlwaysUpError:
            print("Sun is always up on this date.")
            return []
        except ephem.NeverUpError:
            # This can happen in polar regions, we can assume the whole day is dark
            sunset_time = self.start_date.replace(hour=0, minute=0, second=0)

        # End of the night is next rising of the sun
        try:
            sunrise_time = self.observer.next_rising(ephem.Sun(), use_center=True).datetime()
        except ephem.AlwaysUpError:
             # This can happen in polar regions, we can assume the whole day is dark
            sunrise_time = self.start_date.replace(hour=23, minute=59, second=59)
        except ephem.NeverUpError:
            print("Sun is never up on this date.")
            return []

        visibility_data = []
        current_time = sunset_time
        
        moon = ephem.Moon()

        while current_time < sunrise_time:
            self.observer.date = current_time
            self.target_body.compute(self.observer)
            moon.compute(self.observer)

            # Convert radians to degrees
            target_alt = math.degrees(self.target_body.alt)
            target_az = math.degrees(self.target_body.az)
            moon_alt = math.degrees(moon.alt)

            visibility_data.append({
                "timestamp_utc": current_time.strftime('%Y-%m-%d %H:%M:%S'),
                "target_altitude_deg": round(target_alt, 2),
                "target_azimuth_deg": round(target_az, 2),
                "moon_altitude_deg": round(moon_alt, 2),
                "is_visible": target_alt > 0
            })
            current_time += datetime.timedelta(minutes=interval_minutes)
            
        return visibility_data

    def get_year_visibility(self):
        """
        Calculates the visibility of the target at midnight for a full year, starting from the observation date.
        Returns data as a list of dictionaries.
        """
        year_data = []
        # Start from the beginning of the provided observation day
        current_date = self.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        moon = ephem.Moon()

        for day in range(365):
            check_time = current_date + datetime.timedelta(days=day)
            
            # Set observer to midnight local time, approximately
            # A more accurate way would be to find solar midnight
            self.observer.date = check_time - datetime.timedelta(hours=self.timezone_offset)

            self.target_body.compute(self.observer)
            moon.compute(self.observer)
            
            target_alt = math.degrees(self.target_body.alt)
            moon_alt = math.degrees(moon.alt)
            
            # Calculate moon phase
            sun = ephem.Sun()
            sun.compute(self.observer)
            elongation = math.degrees(ephem.separation(moon, sun))
            moon_phase_percent = (180.0 - elongation) / 180.0 * 100

            year_data.append({
                "date": check_time.strftime('%Y-%m-%d'),
                "target_altitude_at_midnight_deg": round(target_alt, 2),
                "moon_altitude_at_midnight_deg": round(moon_alt, 2),
                "moon_phase_percent": round(moon_phase_percent, 1)
            })

        return year_data

    # function to convert decimal ra dec to string format 09:55:33.17 69:03:55.00
    def _convert_deg_to_str_array(self, ra_deg, dec_deg):
        """Converts RA/Dec in decimal degrees to string format 'HH:MM:SS.ss DD:MM:SS.ss'."""
        if not (-180 <= ra_deg <= 180) or not (-90 <= dec_deg <= 90):
            raise ValueError("RA must be between -180 and 180 degrees, Dec must be between -90 and 90 degrees. RA is " + str(ra_deg) + " and Dec is " + str(dec_deg))

        ra_hours = ra_deg / 15.0
        ra_minutes = (ra_hours - int(ra_hours)) * 60
        ra_seconds = (ra_minutes - int(ra_minutes)) * 60
        ra_fractions = (ra_seconds - int(ra_seconds)) * 100

        dec_degrees = dec_deg
        dec_minutes = (dec_degrees - int(dec_degrees)) * 60
        dec_seconds = (dec_minutes - int(dec_minutes)) * 60
        dec_fractions = (dec_seconds - int(dec_seconds)) * 100

        return [f"{int(ra_hours):02}:{int(ra_minutes):02}:{int(ra_seconds):02}.{int(ra_fractions):02}", f"{int(dec_degrees):02}:{int(dec_minutes):02}:{int(dec_seconds):02}.{int(dec_fractions):02}"]

    # function to get mosaic coordinates
    # Returns a list of lists with dictionaries containing panel name, RA/Dec in degrees and hours, and string format
    def get_mosaic_coordinates(self, grid_size_x, grid_size_y, grid_overlap_percent=20):
        """
        Calculates the RA/Dec coordinates for a mosaic grid.
        Returns a list of lists with RA/Dec tuples in decimal hours and degrees.
        """
        if grid_size_x <= 0 or grid_size_y <= 0:
            return []

        mosaic_panels = []
        colnames = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I' ]
        if grid_size_x > len(colnames):
            raise ValueError(f"Grid size X ({grid_size_x}) exceeds maximum supported columns ({len(colnames)}).")

        if grid_size_y > len(colnames):
            raise ValueError(f"Grid size Y ({grid_size_y}) exceeds maximum supported rows ({len(colnames)}).")

        # Overlap factor
        img_fov_factor = 1 - (grid_overlap_percent / 100.0)
        
        # Effective FoV for stepping
        step_x_deg = self.fov_x_deg * img_fov_factor
        step_y_deg = self.fov_y_deg * img_fov_factor

        start_x = -step_x_deg * (grid_size_x - 1) / 2.0
        start_y = -step_y_deg * (grid_size_y - 1) / 2.0

        for i in range(grid_size_y):
            row_panels = []
            dec_offset = start_y + i * step_y_deg
            panel_dec = self.dec_deg + dec_offset
            
            # RA step needs to be corrected for declination
            ra_correction = 1 / math.cos(math.radians(panel_dec))

            for j in range(grid_size_x):
                ra_offset = start_x + j * step_x_deg
                panel_ra = self.ra_deg + (ra_offset * ra_correction)
                # Normalize RA to be within -180 and 180 degrees
                if panel_ra < -180.0 or panel_ra > 180.0:
                    panel_ra = panel_ra % 360.0
                if panel_dec < -90.0 or panel_dec > 90.0:
                    panel_dec = panel_dec % 360.0

                # Convert RA/Dec to string format
                radec_str = self._convert_deg_to_str_array(panel_ra, panel_dec)
                # Append the panel data
                row_panels.append({
                    "panel": f"{colnames[i]}{j+1}",
                    "ra_deg": round(panel_ra, 6),
                    "ra_hour": round(panel_ra / 15.0, 6),
                    "dec_deg": round(panel_dec, 6),
                    "ra_str": radec_str[0],
                    "dec_str": radec_str[1]
                })
            mosaic_panels.append(row_panels)

        return mosaic_panels

