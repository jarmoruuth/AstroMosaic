from AstroMosaicEngine import AstroMosaicEngine

# Convert arcminutes to degrees
def arcminutes_to_degrees(arcminutes):
    """Convert arcminutes to degrees."""
    return arcminutes / 60.0

# --- Example Usage of AstroMosaicEngine ---
if __name__ == '__main__':
    # Observer's location (Telescope Live SPA-1)
    LATITUDE = 37.4988
    LONGITUDE = -2.42178
    TIMEZONE = 0 # UTC

    # Telescope/Camera setup
    # Needed only for mosaic calculations
    FOV_X = arcminutes_to_degrees(321)  # degrees
    FOV_Y = arcminutes_to_degrees(214)  # degrees

    # Target and Date
    # TARGET_NAME = "M81"                   Name resolver does not work   
    # TARGET_NAME = "148.88821 69.06528"
    # TARGET_NAME = "9.92588 69.06528"
    TARGET_NAME = "09:55:33.17 69:03:55.00"
    OBSERVATION_DATE = "2025-06-09" # A specific date

    print(f"Initializing AstroMosaic Engine for target: {TARGET_NAME}")
    print(f"Calculating for the night of: {OBSERVATION_DATE}\n")
    try:
        engine = AstroMosaicEngine(
            target=TARGET_NAME,
            lat=LATITUDE,
            lon=LONGITUDE,
            fov_x_deg=FOV_X,
            fov_y_deg=FOV_Y,
            observation_date=OBSERVATION_DATE, # Pass the specific date here
            timezone_offset=TIMEZONE
        )

        # 1. Get Day Visibility Table
        print("--- Daily Visibility Table ---")
        day_data = engine.get_day_visibility()
        if day_data:
            # Print header
            print(f"{'Timestamp (UTC)':<22} | {'Target Alt (deg)':<20} | {'Target Az (deg)':<20} | {'Moon Alt (deg)':<20}")
            print("-" * 88)
            # Print first 10 and last 5 rows for brevity
            for row in day_data[:10]:
                print(
                    f"{row['timestamp_utc']:<22} | {row['target_altitude_deg']:<20.2f} | "
                    f"{row['target_azimuth_deg']:<20.2f} | {row['moon_altitude_deg']:<20.2f}"
                )
            if len(day_data) > 15:
                print("...")
                for row in day_data[-5:]:
                    print(
                        f"{row['timestamp_utc']:<22} | {row['target_altitude_deg']:<20.2f} | "
                        f"{row['target_azimuth_deg']:<20.2f} | {row['moon_altitude_deg']:<20.2f}"
                    )
        else:
            print("Could not generate daily visibility data.")
        
        print("\n" + "="*88 + "\n")

        # 2. Get Year Visibility Table
        print("--- Yearly Visibility Table (at midnight) ---")
        year_data = engine.get_year_visibility()
        if year_data:
            print(f"{'Date':<12} | {'Target Alt (deg)':<20} | {'Moon Alt (deg)':<20} | {'Moon Phase (%)':<20}")
            print("-" * 80)
            # Print data for every ~30 days
            for i in range(0, 365, 30):
                row = year_data[i]
                print(
                    f"{row['date']:<12} | {row['target_altitude_at_midnight_deg']:<20.2f} | "
                    f"{row['moon_altitude_at_midnight_deg']:<20.2f} | {row['moon_phase_percent']:<20.1f}"
                )
        else:
            print("Could not generate yearly visibility data.")

        print("\n" + "="*88 + "\n")

        # 3. Get Mosaic Coordinates Table
        print("--- 3x3 Mosaic Coordinates Table ---")
        mosaic_data = engine.get_mosaic_coordinates(grid_size_x=3, grid_size_y=3)
        if mosaic_data:
            print(f"{'Panel':<8} | {'RA (deg)':<18} | {'Dec (deg)':<18}")
            print("-" * 48)
            for row in mosaic_data:
                for panel in row:
                    print(f"{panel['panel']:<8} | {panel['ra_str']:<18} | {panel['dec_str']:<18}")
        else:
            print("Could not generate mosaic data.")
            
    except (ValueError, TypeError) as e:
        print(f"Error: {e}")